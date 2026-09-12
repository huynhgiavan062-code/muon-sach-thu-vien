const { dbAll, dbGet, dbRun, dbTransaction } = require('../config/database');

const Borrow = {
  getSetting(key, defaultValue = '') {
    const row = dbGet('SELECT value FROM system_settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  },

  generateBorrowCode() {
    const today = new Date();
    const year = today.getFullYear();
    const prefix = `PM-${year}-`;
    const last = dbGet("SELECT borrow_code FROM borrow_records WHERE borrow_code LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);

    if (!last || !last.borrow_code) {
      return `${prefix}0001`;
    }
    const match = last.borrow_code.match(new RegExp(`^PM-${year}-(\\d+)$`));
    if (!match) {
      return `${prefix}${Date.now().toString().slice(-4)}`;
    }
    const nextNum = parseInt(match[1], 10) + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  },

  // Update status of overdue records
  refreshOverdueStatuses() {
    const today = new Date().toISOString().split('T')[0];
    dbRun(`
      UPDATE borrow_records 
      SET status = 'overdue', updated_at = CURRENT_TIMESTAMP 
      WHERE status = 'borrowing' AND due_date < ?
    `, [today]);
  },

  findAll({
    page = 1,
    limit = 10,
    search = '',
    status = '',
    user_id = '',
    from_date = '',
    to_date = ''
  } = {}) {
    this.refreshOverdueStatuses();

    const where = [];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      where.push(`(
        br.borrow_code LIKE ? OR 
        u.full_name LIKE ? OR 
        u.reader_code LIKE ? OR 
        u.username LIKE ? OR
        EXISTS (
          SELECT 1 FROM borrow_details bd 
          JOIN books b ON bd.book_id = b.id 
          WHERE bd.borrow_record_id = br.id AND (b.title LIKE ? OR b.book_code LIKE ?)
        )
      )`);
      params.push(s, s, s, s, s, s);
    }

    if (status) {
      where.push("br.status = ?");
      params.push(status);
    }

    if (user_id) {
      where.push("br.user_id = ?");
      params.push(Number(user_id));
    }

    if (from_date) {
      where.push("br.borrow_date >= ?");
      params.push(from_date);
    }

    if (to_date) {
      where.push("br.borrow_date <= ?");
      params.push(to_date);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = dbGet(`
      SELECT COUNT(*) as total 
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      ${whereClause}
    `, params);
    const total = countResult ? countResult.total : 0;

    const offset = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT 
        br.id, br.borrow_code, br.user_id, br.admin_id,
        br.borrow_date, br.due_date, br.return_date, br.status,
        br.renewal_count, br.notes, br.created_at,
        u.full_name as user_full_name, u.reader_code as user_reader_code,
        u.email as user_email, u.phone as user_phone,
        adm.full_name as admin_full_name,
        (
          SELECT COUNT(*) 
          FROM borrow_details bd 
          WHERE bd.borrow_record_id = br.id
        ) as total_books_count
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      LEFT JOIN users adm ON br.admin_id = adm.id
      ${whereClause}
      ORDER BY br.borrow_date DESC, br.id DESC
      LIMIT ? OFFSET ?
    `;

    const records = dbAll(sql, [...params, Number(limit), offset]);

    // Attach book items to each record
    for (const record of records) {
      record.items = dbAll(`
        SELECT 
          bd.id as detail_id, bd.book_id, bd.quantity, bd.returned_quantity, bd.condition_note,
          b.book_code, b.title, b.isbn, b.cover_image,
          s.code as shelf_code
        FROM borrow_details bd
        JOIN books b ON bd.book_id = b.id
        LEFT JOIN shelves s ON b.shelf_id = s.id
        WHERE bd.borrow_record_id = ?
      `, [record.id]);
    }

    return {
      data: records,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  findById(id) {
    this.refreshOverdueStatuses();

    const sql = `
      SELECT 
        br.*,
        u.full_name as user_full_name, u.reader_code as user_reader_code,
        u.email as user_email, u.phone as user_phone,
        adm.full_name as admin_full_name
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      LEFT JOIN users adm ON br.admin_id = adm.id
      WHERE br.id = ?
    `;
    const record = dbGet(sql, [id]);
    if (!record) return null;

    record.items = dbAll(`
      SELECT 
        bd.*,
        b.book_code, b.title, b.isbn, b.cover_image, b.available_quantity,
        s.code as shelf_code, s.location as shelf_location,
        a.name as author_name
      FROM borrow_details bd
      JOIN books b ON bd.book_id = b.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      LEFT JOIN authors a ON b.author_id = a.id
      WHERE bd.borrow_record_id = ?
    `, [id]);

    record.fines = dbAll(`
      SELECT * FROM fines WHERE borrow_record_id = ?
    `, [id]);

    return record;
  },

  // ==================== BORROW TRANSACTION ====================
  borrowBooks({ user_id, admin_id, book_ids, notes, custom_due_date }) {
    if (!user_id) throw new Error('Vui lòng chọn độc giả mượn sách.');
    if (!book_ids || !Array.isArray(book_ids) || book_ids.length === 0) {
      throw new Error('Vui lòng chọn ít nhất 1 cuốn sách để mượn.');
    }

    return dbTransaction((tx) => {
      // 1. Check user exists and active
      const user = tx.dbGet('SELECT * FROM users WHERE id = ?', [user_id]);
      if (!user) throw new Error('Không tìm thấy độc giả trên hệ thống.');
      if (user.status === 'locked') {
        throw new Error(`Tài khoản độc giả "${user.full_name}" đang bị KHÓA. Không thể mượn sách.`);
      }
      if (user.status === 'suspended') {
        throw new Error(`Tài khoản độc giả "${user.full_name}" đang bị TẠM NGƯNG. Không thể mượn sách.`);
      }

      // 2. Check max borrow limit
      const maxBorrow = parseInt(this.getSetting('max_borrow_books', '5'), 10);
      const activeCountRow = tx.dbGet(`
        SELECT COUNT(*) as count 
        FROM borrow_records br
        JOIN borrow_details bd ON br.id = bd.borrow_record_id
        WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
      `, [user_id]);
      const currentActiveCount = activeCountRow ? activeCountRow.count : 0;

      if (currentActiveCount + book_ids.length > maxBorrow) {
        throw new Error(
          `Vượt quá giới hạn mượn sách! Độc giả đang mượn ${currentActiveCount} cuốn. ` +
          `Số lượng tối đa được phép là ${maxBorrow} cuốn.`
        );
      }

      // 3. Check unpaid fines
      const unpaidFinesRow = tx.dbGet(`
        SELECT COUNT(*) as count, SUM(amount - paid_amount) as total
        FROM fines
        WHERE user_id = ? AND status = 'unpaid'
      `, [user_id]);
      if (unpaidFinesRow && unpaidFinesRow.count > 0 && unpaidFinesRow.total > 50000) {
        throw new Error(`Độc giả đang có khoản tiền phạt chưa thanh toán (${unpaidFinesRow.total.toLocaleString('vi-VN')} đ). Vui lòng nộp phạt trước khi tiếp tục mượn sách.`);
      }

      // 4. Check each book availability
      for (const bId of book_ids) {
        const book = tx.dbGet('SELECT * FROM books WHERE id = ?', [bId]);
        if (!book) throw new Error(`Không tìm thấy cuốn sách có ID ${bId}.`);
        if (book.available_quantity <= 0) {
          throw new Error(`Sách "${book.title}" (${book.book_code}) đã hết số lượng khả dụng trong kho.`);
        }
      }

      // 5. Generate dates and borrow_code
      const borrowCode = this.generateBorrowCode();
      const borrowDurationDays = parseInt(this.getSetting('borrow_duration_days', '14'), 10);
      const today = new Date();
      const borrowDateStr = today.toISOString().split('T')[0];

      let dueDateStr;
      if (custom_due_date) {
        dueDateStr = custom_due_date;
      } else {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + borrowDurationDays);
        dueDateStr = dueDate.toISOString().split('T')[0];
      }

      // 6. Insert borrow_record
      const recordResult = tx.dbRun(`
        INSERT INTO borrow_records (
          borrow_code, user_id, admin_id, borrow_date, due_date, status, notes
        ) VALUES (?, ?, ?, ?, ?, 'borrowing', ?)
      `, [borrowCode, user_id, admin_id || null, borrowDateStr, dueDateStr, notes || null]);

      const borrowRecordId = recordResult.lastInsertRowid;

      // 7. Insert borrow_details and decrement book quantity
      for (const bId of book_ids) {
        tx.dbRun(`
          INSERT INTO borrow_details (borrow_record_id, book_id, quantity, returned_quantity)
          VALUES (?, ?, 1, 0)
        `, [borrowRecordId, bId]);

        tx.dbRun(`
          UPDATE books 
          SET available_quantity = available_quantity - 1, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [bId]);
      }

      // 8. Create notification for user
      tx.dbRun(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `, [
        user_id,
        'Mượn sách thành công',
        `Bạn đã mượn thành công ${book_ids.length} cuốn sách (Mã phiếu: ${borrowCode}). Hạn trả: ${dueDateStr}.`
      ]);

      return {
        id: borrowRecordId,
        borrow_code: borrowCode,
        borrow_date: borrowDateStr,
        due_date: dueDateStr,
        book_count: book_ids.length
      };
    });
  },

  // ==================== RETURN TRANSACTION ====================
  returnBooks({ borrow_record_id, admin_id, condition_notes }) {
    if (!borrow_record_id) throw new Error('Vui lòng cung cấp mã phiếu mượn cần trả.');

    return dbTransaction((tx) => {
      const record = tx.dbGet('SELECT * FROM borrow_records WHERE id = ?', [borrow_record_id]);
      if (!record) throw new Error('Không tìm thấy phiếu mượn.');
      if (record.status === 'returned') {
        throw new Error(`Phiếu mượn ${record.borrow_code} đã được hoàn tất trả trước đó.`);
      }

      const today = new Date();
      const returnDateStr = today.toISOString().split('T')[0];
      const items = tx.dbAll('SELECT * FROM borrow_details WHERE borrow_record_id = ?', [borrow_record_id]);

      // Calculate overdue fine
      let fineAmount = 0;
      let overdueDays = 0;
      const dueDate = new Date(record.due_date);
      const returnDate = new Date(returnDateStr);

      if (returnDate > dueDate) {
        const diffMs = returnDate.getTime() - dueDate.getTime();
        overdueDays = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
        const finePerDay = parseInt(this.getSetting('fine_per_day', '5000'), 10);
        fineAmount = overdueDays * finePerDay;
      }

      // 1. Update borrow record
      tx.dbRun(`
        UPDATE borrow_records 
        SET return_date = ?, status = 'returned', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [returnDateStr, borrow_record_id]);

      // 2. Increase available quantity of books & update details
      for (const item of items) {
        tx.dbRun(`
          UPDATE borrow_details 
          SET returned_quantity = quantity, condition_note = ? 
          WHERE id = ?
        `, [condition_notes || null, item.id]);

        tx.dbRun(`
          UPDATE books 
          SET available_quantity = available_quantity + ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `, [item.quantity, item.book_id]);

        // Check if there are reservations waiting for this book
        const reservation = tx.dbGet(`
          SELECT * FROM reservations 
          WHERE book_id = ? AND status = 'pending' 
          ORDER BY reservation_date ASC LIMIT 1
        `, [item.book_id]);

        if (reservation) {
          const expiryDays = parseInt(this.getSetting('reservation_expiry_days', '3'), 10);
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + expiryDays);

          tx.dbRun(`
            UPDATE reservations 
            SET status = 'ready', expiry_date = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [expDate.toISOString().split('T')[0], reservation.id]);

          // Notify reservation user
          const bookInfo = tx.dbGet('SELECT title FROM books WHERE id = ?', [item.book_id]);
          tx.dbRun(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'info')
          `, [
            reservation.user_id,
            'Sách đặt trước đã có sẵn',
            `Sách "${bookInfo ? bookInfo.title : ''}" bạn đặt trước đã có sẵn tại thư viện. Vui lòng đến nhận trước ngày ${expDate.toISOString().split('T')[0]}.`
          ]);
        }
      }

      // 3. Create Fine record if overdue
      let createdFine = null;
      if (fineAmount > 0) {
        const fineRes = tx.dbRun(`
          INSERT INTO fines (
            borrow_record_id, user_id, book_id, reason, overdue_days, amount, paid_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid')
        `, [
          borrow_record_id,
          record.user_id,
          items.length > 0 ? items[0].book_id : null,
          `Quá hạn ${overdueDays} ngày (Hạn trả: ${record.due_date})`,
          overdueDays,
          fineAmount
        ]);

        createdFine = {
          id: fineRes.lastInsertRowid,
          amount: fineAmount,
          overdueDays
        };

        // Notify fine
        tx.dbRun(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'warning')
        `, [
          record.user_id,
          'Phát sinh tiền phạt quá hạn',
          `Phiếu mượn ${record.borrow_code} bị quá hạn ${overdueDays} ngày. Số tiền phạt phát sinh: ${fineAmount.toLocaleString('vi-VN')} đ.`
        ]);
      } else {
        // Normal return notification
        tx.dbRun(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'success')
        `, [
          record.user_id,
          'Trả sách thành công',
          `Bạn đã hoàn tất trả sách cho phiếu mượn ${record.borrow_code}. Cảm ơn bạn!`
        ]);
      }

      return {
        borrow_code: record.borrow_code,
        return_date: returnDateStr,
        overdue_days: overdueDays,
        fine_amount: fineAmount,
        fine: createdFine
      };
    });
  },

  renewBorrow(borrow_record_id, user_id, is_admin = false) {
    this.refreshOverdueStatuses();
    const record = this.findById(borrow_record_id);
    if (!record) throw new Error('Không tìm thấy phiếu mượn.');

    if (!is_admin && record.user_id !== user_id) {
      throw new Error('Bạn không có quyền gia hạn phiếu mượn này.');
    }

    if (record.status === 'returned') {
      throw new Error('Phiếu mượn này đã được hoàn tất trả sách, không thể gia hạn.');
    }

    const today = new Date().toISOString().split('T')[0];
    if (record.status === 'overdue' || record.due_date < today) {
      throw new Error('Không thể gia hạn phiếu mượn đã quá hạn. Vui lòng mang sách đến thư viện hoàn trả.');
    }

    const maxRenewals = parseInt(this.getSetting('max_renewals', '2'), 10);
    if ((record.renewal_count || 0) >= maxRenewals) {
      throw new Error(`Phiếu mượn đã đạt giới hạn gia hạn tối đa (${maxRenewals} lần).`);
    }

    // Check if any book has pending reservations by other readers
    for (const item of record.items || []) {
      const reservation = dbGet(
        "SELECT * FROM reservations WHERE book_id = ? AND status = 'pending' AND user_id != ?",
        [item.book_id, record.user_id]
      );
      if (reservation) {
        throw new Error(`Sách "${item.title}" đang có độc giả khác đặt trước trong hàng đợi. Không thể gia hạn thêm.`);
      }
    }

    const renewalDays = parseInt(this.getSetting('renewal_days', '7'), 10);
    const currentDue = new Date(record.due_date);
    currentDue.setDate(currentDue.getDate() + renewalDays);
    const newDueDateStr = currentDue.toISOString().split('T')[0];
    const newCount = (record.renewal_count || 0) + 1;

    dbRun(`
      UPDATE borrow_records 
      SET due_date = ?, renewal_count = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [newDueDateStr, newCount, borrow_record_id]);

    // Create notification
    dbRun(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'info')
    `, [
      record.user_id,
      'Gia hạn sách thành công',
      `Phiếu mượn ${record.borrow_code} đã được gia hạn thêm ${renewalDays} ngày (Lần ${newCount}/${maxRenewals}). Hạn trả mới: ${newDueDateStr}.`
    ]);

    return {
      borrow_record_id,
      borrow_code: record.borrow_code,
      old_due_date: record.due_date,
      new_due_date: newDueDateStr,
      renewal_count: newCount,
      max_renewals: maxRenewals
    };
  },

  getStats() {
    this.refreshOverdueStatuses();
    const borrowing = dbGet("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'borrowing'");
    const overdue = dbGet("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'overdue'");
    const returned = dbGet("SELECT COUNT(*) as count FROM borrow_records WHERE status = 'returned'");
    const totalBorrows = dbGet("SELECT COUNT(*) as count FROM borrow_records");

    return {
      borrowingCount: borrowing?.count || 0,
      overdueCount: overdue?.count || 0,
      returnedCount: returned?.count || 0,
      totalCount: totalBorrows?.count || 0
    };
  }
};

module.exports = Borrow;
