const { dbAll, dbGet, dbRun, dbTransaction } = require('../config/database');

function getVietnamNow(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map(p => [p.type, p.value]));
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
  const dateTimeStr = `${dateStr} ${timeStr}`;
  const isoStr = `${dateStr}T${timeStr}+07:00`;
  return { dateStr, timeStr, dateTimeStr, isoStr, timestamp: date.getTime() };
}

const BorrowRequest = {
  getSetting(key, defaultValue = '') {
    const row = dbGet('SELECT value FROM system_settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  },

  generateRequestCode() {
    const vnNow = getVietnamNow();
    const year = vnNow.dateStr.split('-')[0];
    const prefix = `RQ-${year}-`;
    const last = dbGet("SELECT request_code FROM borrow_requests WHERE request_code LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);

    if (!last || !last.request_code) {
      return `${prefix}0001`;
    }
    const match = last.request_code.match(new RegExp(`^RQ-${year}-(\\d+)$`));
    if (!match) {
      return `${prefix}${Date.now().toString().slice(-4)}`;
    }
    const nextNum = parseInt(match[1], 10) + 1;
    return `${prefix}${String(nextNum).padStart(4, '0')}`;
  },

  createRequest({ user_id, book_id }) {
    if (!user_id) throw new Error('Vui lòng cung cấp mã độc giả.');
    if (!book_id) throw new Error('Vui lòng chọn cuốn sách cần mượn.');

    // 1. Check user status
    const user = dbGet('SELECT id, full_name, status FROM users WHERE id = ?', [user_id]);
    if (!user) throw new Error('Không tìm thấy thông tin độc giả.');
    if (user.status === 'locked') {
      throw new Error('Tài khoản của bạn đang bị KHÓA. Không thể gửi yêu cầu mượn sách.');
    }
    if (user.status === 'suspended') {
      throw new Error('Tài khoản của bạn đang bị TẠM NGƯNG. Không thể gửi yêu cầu mượn sách.');
    }

    // 2. Check book availability
    const book = dbGet('SELECT id, book_code, title, available_quantity FROM books WHERE id = ?', [book_id]);
    if (!book) throw new Error('Không tìm thấy thông tin sách.');
    if (book.available_quantity <= 0) {
      throw new Error(`Sách "${book.title}" hiện đã hết trong kho. Bạn có thể sử dụng chức năng Đặt trước.`);
    }

    // 3. Check if user already has a pending request for this book
    const existingPending = dbGet(`
      SELECT id, request_code, requested_at 
      FROM borrow_requests 
      WHERE user_id = ? AND book_id = ? AND status = 'pending'
      LIMIT 1
    `, [user_id, book_id]);
    if (existingPending) {
      throw new Error(`Bạn đã gửi yêu cầu mượn cuốn sách này (Mã: ${existingPending.request_code}) và đang chờ Admin xác nhận.`);
    }

    // 4. Check if user is currently borrowing this book
    const activeBorrow = dbGet(`
      SELECT br.id, br.borrow_code 
      FROM borrow_records br
      JOIN borrow_details bd ON br.id = bd.borrow_record_id
      WHERE br.user_id = ? AND bd.book_id = ? AND br.status IN ('borrowing', 'overdue')
      LIMIT 1
    `, [user_id, book_id]);
    if (activeBorrow) {
      throw new Error(`Bạn đang mượn cuốn sách này (Phiếu mượn: ${activeBorrow.borrow_code}). Không thể gửi yêu cầu mượn thêm.`);
    }

    // 5. Check max borrow limit (including pending requests)
    const maxBorrow = parseInt(this.getSetting('max_borrow_books', '5'), 10);
    const activeBorrowsCount = dbGet(`
      SELECT COUNT(*) as count 
      FROM borrow_records br
      JOIN borrow_details bd ON br.id = bd.borrow_record_id
      WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
    `, [user_id])?.count || 0;

    const pendingRequestsCount = dbGet(`
      SELECT COUNT(*) as count 
      FROM borrow_requests 
      WHERE user_id = ? AND status = 'pending'
    `, [user_id])?.count || 0;

    if (activeBorrowsCount + pendingRequestsCount >= maxBorrow) {
      throw new Error(`Bạn đã đạt hạn mức mượn tối đa (${maxBorrow} cuốn, bao gồm ${activeBorrowsCount} cuốn đang giữ và ${pendingRequestsCount} yêu cầu đang chờ duyệt).`);
    }

    // 6. Check unpaid fines
    const unpaidFines = dbGet(`
      SELECT COUNT(*) as count, SUM(amount - paid_amount) as total
      FROM fines
      WHERE user_id = ? AND status = 'unpaid'
    `, [user_id]);
    if (unpaidFines && unpaidFines.count > 0 && unpaidFines.total > 50000) {
      throw new Error(`Bạn đang có khoản nợ phạt chưa thanh toán (${unpaidFines.total.toLocaleString('vi-VN')} đ). Vui lòng thanh toán trước khi gửi yêu cầu mượn.`);
    }

    // 7. Insert borrow_request
    const vnNow = getVietnamNow();
    const requestCode = this.generateRequestCode();

    const insertRes = dbRun(`
      INSERT INTO borrow_requests (
        request_code, user_id, book_id, requested_at, status
      ) VALUES (?, ?, ?, ?, 'pending')
    `, [requestCode, user_id, book_id, vnNow.dateTimeStr]);

    const requestId = insertRes.lastInsertRowid;

    // 8. Create notification for user
    dbRun(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'info')
    `, [
      user_id,
      'Yêu cầu mượn sách đã được gửi',
      `Yêu cầu mượn cuốn sách "${book.title}" (Mã yêu cầu: ${requestCode}) đã được gửi và đang chờ Admin xác nhận.`
    ]);

    return this.findById(requestId);
  },

  findAll({ status = '', user_id = '', search = '', page = 1, limit = 10 } = {}) {
    const where = [];
    const params = [];

    if (status && status.trim()) {
      where.push('br.status = ?');
      params.push(status.trim());
    }

    if (user_id) {
      where.push('br.user_id = ?');
      params.push(Number(user_id));
    }

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      where.push('(br.request_code LIKE ? OR u.full_name LIKE ? OR u.reader_code LIKE ? OR b.title LIKE ? OR b.book_code LIKE ?)');
      params.push(q, q, q, q, q);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countRow = dbGet(`
      SELECT COUNT(*) as total
      FROM borrow_requests br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      ${whereClause}
    `, params);
    const total = countRow ? countRow.total : 0;

    const offset = (Number(page) - 1) * Number(limit);

    const sql = `
      SELECT 
        br.id, br.request_code, br.user_id, br.book_id,
        br.requested_at, br.status, br.processed_at, br.processed_by, br.rejection_reason,
        br.created_at, br.updated_at,
        u.full_name as user_full_name, u.reader_code as user_reader_code, u.phone as user_phone, u.email as user_email, u.status as user_status,
        b.book_code, b.title as book_title, b.isbn, b.cover_image, b.available_quantity,
        a.name as author_name,
        s.code as shelf_code, s.location as shelf_location,
        adm.full_name as processed_by_name
      FROM borrow_requests br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      LEFT JOIN users adm ON br.processed_by = adm.id
      ${whereClause}
      ORDER BY 
        CASE WHEN br.status = 'pending' THEN 0 ELSE 1 END,
        br.requested_at DESC, br.id DESC
      LIMIT ? OFFSET ?
    `;

    const records = dbAll(sql, [...params, Number(limit), offset]);

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
    const sql = `
      SELECT 
        br.id, br.request_code, br.user_id, br.book_id,
        br.requested_at, br.status, br.processed_at, br.processed_by, br.rejection_reason,
        br.created_at, br.updated_at,
        u.full_name as user_full_name, u.reader_code as user_reader_code, u.phone as user_phone, u.email as user_email, u.status as user_status,
        b.book_code, b.title as book_title, b.isbn, b.cover_image, b.available_quantity,
        a.name as author_name,
        s.code as shelf_code, s.location as shelf_location,
        adm.full_name as processed_by_name
      FROM borrow_requests br
      JOIN users u ON br.user_id = u.id
      JOIN books b ON br.book_id = b.id
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      LEFT JOIN users adm ON br.processed_by = adm.id
      WHERE br.id = ?
    `;

    const record = dbGet(sql, [id]);
    if (!record) return null;

    // Attach reader stats (current active borrows & unpaid fines)
    const activeBorrowsCount = dbGet(`
      SELECT COUNT(*) as count 
      FROM borrow_records br
      JOIN borrow_details bd ON br.id = bd.borrow_record_id
      WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
    `, [record.user_id])?.count || 0;

    const unpaidFines = dbGet(`
      SELECT COALESCE(SUM(amount - paid_amount), 0) as total, COUNT(*) as count
      FROM fines 
      WHERE user_id = ? AND status = 'unpaid'
    `, [record.user_id]);

    record.user_active_borrows_count = activeBorrowsCount;
    record.user_unpaid_fines_total = unpaidFines?.total || 0;
    record.user_unpaid_fines_count = unpaidFines?.count || 0;

    return record;
  },

  approveRequest({ request_id, admin_id }) {
    if (!request_id) throw new Error('Vui lòng cung cấp mã yêu cầu mượn.');
    if (!admin_id) throw new Error('Vui lòng cung cấp tài khoản quản trị viên duyệt mượn.');

    return dbTransaction((tx) => {
      // 1. Fetch request with lock check
      const request = tx.dbGet('SELECT * FROM borrow_requests WHERE id = ?', [request_id]);
      if (!request) throw new Error('Không tìm thấy yêu cầu mượn sách.');
      if (request.status !== 'pending') {
        throw new Error(`Yêu cầu này đã ở trạng thái "${request.status}", không thể duyệt lại.`);
      }

      // 2. Validate User
      const user = tx.dbGet('SELECT * FROM users WHERE id = ?', [request.user_id]);
      if (!user) throw new Error('Không tìm thấy độc giả trên hệ thống.');
      if (user.status !== 'active') {
        throw new Error(`Tài khoản độc giả "${user.full_name}" đang ở trạng thái "${user.status}". Không thể duyệt mượn.`);
      }

      // 3. Validate Book availability
      const book = tx.dbGet('SELECT * FROM books WHERE id = ?', [request.book_id]);
      if (!book) throw new Error('Không tìm thấy cuốn sách trong kho.');
      if (book.available_quantity <= 0) {
        throw new Error(`Sách "${book.title}" (${book.book_code}) đã hết số lượng khả dụng trong kho.`);
      }

      // 4. Validate Duplicate Borrow
      const alreadyBorrowing = tx.dbGet(`
        SELECT b.title 
        FROM borrow_records br
        JOIN borrow_details bd ON br.id = bd.borrow_record_id
        JOIN books b ON bd.book_id = b.id
        WHERE br.user_id = ? AND bd.book_id = ? AND br.status IN ('borrowing', 'overdue')
      `, [request.user_id, request.book_id]);
      if (alreadyBorrowing) {
        throw new Error(`Độc giả đang mượn cuốn sách "${alreadyBorrowing.title}". Không thể duyệt mượn thêm cuốn cùng loại.`);
      }

      // 5. Validate Max Borrow Limit
      const maxBorrow = parseInt(this.getSetting('max_borrow_books', '5'), 10);
      const activeCount = tx.dbGet(`
        SELECT COUNT(*) as count 
        FROM borrow_records br
        JOIN borrow_details bd ON br.id = bd.borrow_record_id
        WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
      `, [request.user_id])?.count || 0;

      if (activeCount >= maxBorrow) {
        throw new Error(`Độc giả đã đạt giới hạn mượn sách tối đa (${activeCount}/${maxBorrow} cuốn).`);
      }

      // 6. Generate server timestamp & dates
      const vnNow = getVietnamNow();
      const processedAtStr = vnNow.dateTimeStr;
      const borrowDateStr = vnNow.dateStr;

      const borrowDurationDays = parseInt(this.getSetting('borrow_duration_days', '14'), 10);
      const dueDateObj = new Date(vnNow.timestamp);
      dueDateObj.setDate(dueDateObj.getDate() + borrowDurationDays);
      const vnDue = getVietnamNow(dueDateObj);
      const dueDateStr = `${vnDue.dateStr} 23:59:59`;

      // Generate borrow_code
      const year = vnNow.dateStr.split('-')[0];
      const prefix = `PM-${year}-`;
      const lastBorrow = tx.dbGet("SELECT borrow_code FROM borrow_records WHERE borrow_code LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);
      let nextNum = 1;
      if (lastBorrow && lastBorrow.borrow_code) {
        const m = lastBorrow.borrow_code.match(new RegExp(`^PM-${year}-(\\d+)$`));
        if (m) nextNum = parseInt(m[1], 10) + 1;
      }
      const borrowCode = `${prefix}${String(nextNum).padStart(4, '0')}`;

      // 7. Update BorrowRequest status to 'approved'
      tx.dbRun(`
        UPDATE borrow_requests 
        SET status = 'approved', processed_at = ?, processed_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [processedAtStr, admin_id, request_id]);

      // 8. Insert BorrowRecord
      const recordResult = tx.dbRun(`
        INSERT INTO borrow_records (
          borrow_code, user_id, admin_id, borrow_date, due_date, borrowed_at, returned_at, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'borrowing', ?)
      `, [borrowCode, request.user_id, admin_id, borrowDateStr, dueDateStr, processedAtStr, `Duyệt từ yêu cầu ${request.request_code}`]);

      const borrowRecordId = recordResult.lastInsertRowid;

      // 9. Insert BorrowDetail
      tx.dbRun(`
        INSERT INTO borrow_details (borrow_record_id, book_id, quantity, returned_quantity)
        VALUES (?, ?, 1, 0)
      `, [borrowRecordId, request.book_id]);

      // 10. Decrement available_quantity
      tx.dbRun(`
        UPDATE books 
        SET available_quantity = available_quantity - 1, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [request.book_id]);

      // 11. Create Notification for User
      tx.dbRun(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `, [
        request.user_id,
        'Yêu cầu mượn sách đã được duyệt',
        `Yêu cầu mượn cuốn sách "${book.title}" đã được chấp nhận! Mã phiếu mượn: ${borrowCode}. Hạn trả: ${dueDateStr}.`
      ]);

      return {
        request_id,
        request_code: request.request_code,
        status: 'approved',
        processed_at: processedAtStr,
        borrow_record_id: borrowRecordId,
        borrow_code: borrowCode,
        borrowed_at: processedAtStr,
        due_date: dueDateStr
      };
    });
  },

  rejectRequest({ request_id, admin_id, rejection_reason }) {
    if (!request_id) throw new Error('Vui lòng cung cấp mã yêu cầu mượn.');
    if (!admin_id) throw new Error('Vui lòng cung cấp tài khoản quản trị viên.');
    if (!rejection_reason || !rejection_reason.trim()) {
      throw new Error('Vui lòng nhập lý do từ chối yêu cầu mượn sách.');
    }

    const request = dbGet('SELECT * FROM borrow_requests WHERE id = ?', [request_id]);
    if (!request) throw new Error('Không tìm thấy yêu cầu mượn sách.');
    if (request.status !== 'pending') {
      throw new Error(`Yêu cầu này đã ở trạng thái "${request.status}", không thể từ chối.`);
    }

    const book = dbGet('SELECT title FROM books WHERE id = ?', [request.book_id]);
    const vnNow = getVietnamNow();
    const reason = rejection_reason.trim();

    dbRun(`
      UPDATE borrow_requests 
      SET status = 'rejected', rejection_reason = ?, processed_at = ?, processed_by = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [reason, vnNow.dateTimeStr, admin_id, request_id]);

    // Create Notification for user
    dbRun(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, 'warning')
    `, [
      request.user_id,
      'Yêu cầu mượn sách bị từ chối',
      `Yêu cầu mượn cuốn sách "${book ? book.title : ''}" (Mã: ${request.request_code}) đã bị từ chối. Lý do: ${reason}`
    ]);

    return this.findById(request_id);
  },

  cancelRequest({ request_id, user_id }) {
    const request = dbGet('SELECT * FROM borrow_requests WHERE id = ?', [request_id]);
    if (!request) throw new Error('Không tìm thấy yêu cầu mượn sách.');
    if (request.user_id !== user_id) {
      throw new Error('Bạn không có quyền hủy yêu cầu của người khác.');
    }
    if (request.status !== 'pending') {
      throw new Error('Chỉ có thể hủy yêu cầu đang ở trạng thái chờ duyệt (Pending).');
    }

    const vnNow = getVietnamNow();
    dbRun(`
      UPDATE borrow_requests 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `, [request_id]);

    return { success: true, message: 'Đã hủy yêu cầu mượn sách.' };
  },

  getStats() {
    const pending = dbGet("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'pending'");
    const approved = dbGet("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'approved'");
    const rejected = dbGet("SELECT COUNT(*) as count FROM borrow_requests WHERE status = 'rejected'");
    const total = dbGet("SELECT COUNT(*) as count FROM borrow_requests");

    return {
      pendingCount: pending?.count || 0,
      approvedCount: approved?.count || 0,
      rejectedCount: rejected?.count || 0,
      totalCount: total?.count || 0
    };
  }
};

module.exports = BorrowRequest;
