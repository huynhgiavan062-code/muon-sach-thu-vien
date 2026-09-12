const { dbAll, dbGet, dbRun, dbTransaction } = require('../config/database');

const Reservation = {
  getSetting(key, defaultValue = '') {
    const row = dbGet('SELECT value FROM system_settings WHERE key = ?', [key]);
    return row ? row.value : defaultValue;
  },

  findAll({
    page = 1,
    limit = 10,
    search = '',
    status = '',
    user_id = '',
    book_id = ''
  } = {}) {
    const where = [];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      where.push(`(
        u.full_name LIKE ? OR 
        u.reader_code LIKE ? OR 
        u.username LIKE ? OR 
        b.title LIKE ? OR 
        b.book_code LIKE ?
      )`);
      params.push(s, s, s, s, s);
    }

    if (status) {
      where.push("r.status = ?");
      params.push(status);
    }

    if (user_id) {
      where.push("r.user_id = ?");
      params.push(Number(user_id));
    }

    if (book_id) {
      where.push("r.book_id = ?");
      params.push(Number(book_id));
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = dbGet(`
      SELECT COUNT(*) as total 
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN books b ON r.book_id = b.id
      ${whereClause}
    `, params);
    const total = countResult ? countResult.total : 0;

    const offset = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT 
        r.id, r.user_id, r.book_id, r.reservation_date,
        r.status, r.queue_position, r.expiry_date, r.notes,
        r.created_at, r.updated_at,
        u.full_name as user_full_name, u.reader_code as user_reader_code,
        u.email as user_email, u.phone as user_phone,
        b.title as book_title, b.book_code, b.cover_image,
        b.available_quantity,
        s.code as shelf_code, s.location as shelf_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN books b ON r.book_id = b.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      ${whereClause}
      ORDER BY 
        CASE r.status 
          WHEN 'ready' THEN 1 
          WHEN 'pending' THEN 2 
          ELSE 3 
        END,
        r.reservation_date ASC
      LIMIT ? OFFSET ?
    `;

    const reservations = dbAll(sql, [...params, Number(limit), offset]);

    return {
      data: reservations,
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
        r.*,
        u.full_name as user_full_name, u.reader_code as user_reader_code,
        u.email as user_email, u.phone as user_phone,
        b.title as book_title, b.book_code, b.cover_image,
        b.available_quantity,
        s.code as shelf_code, s.location as shelf_location
      FROM reservations r
      JOIN users u ON r.user_id = u.id
      JOIN books b ON r.book_id = b.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      WHERE r.id = ?
    `;
    return dbGet(sql, [id]);
  },

  createReservation({ user_id, book_id, notes }) {
    if (!user_id || !book_id) {
      throw new Error('Vui lòng cung cấp đầy đủ thông tin độc giả và đầu sách.');
    }

    return dbTransaction((tx) => {
      // 1. Verify user
      const user = tx.dbGet('SELECT * FROM users WHERE id = ?', [user_id]);
      if (!user) throw new Error('Không tìm thấy độc giả.');
      if (user.status === 'locked' || user.status === 'suspended') {
        throw new Error('Tài khoản của bạn đang bị khóa, không thể đặt trước sách.');
      }

      // 2. Verify book
      const book = tx.dbGet('SELECT * FROM books WHERE id = ?', [book_id]);
      if (!book) throw new Error('Không tìm thấy cuốn sách này.');

      // 3. Check existing active reservation by this user for this book
      const existing = tx.dbGet(
        "SELECT * FROM reservations WHERE user_id = ? AND book_id = ? AND status IN ('pending', 'ready')",
        [user_id, book_id]
      );
      if (existing) {
        throw new Error(`Bạn đã có lượt đặt trước cho sách "${book.title}" (${existing.status === 'ready' ? 'Sách đã sẵn sàng' : 'Đang chờ'}).`);
      }

      // 4. Check if currently borrowing this book
      const currentlyBorrowing = tx.dbGet(`
        SELECT COUNT(*) as count 
        FROM borrow_records br
        JOIN borrow_details bd ON br.id = bd.borrow_record_id
        WHERE br.user_id = ? AND bd.book_id = ? AND br.status IN ('borrowing', 'overdue')
      `, [user_id, book_id]);
      if (currentlyBorrowing && currentlyBorrowing.count > 0) {
        throw new Error(`Bạn hiện đang mượn cuốn sách "${book.title}", không thể đặt trước.`);
      }

      // 5. Calculate queue and availability status
      const expiryDays = parseInt(this.getSetting('reservation_expiry_days', '3'), 10);
      let initialStatus = 'pending';
      let queuePos = 1;
      let expDateStr = null;

      if (book.available_quantity > 0) {
        // Book is available right now -> instantly reserve and hold
        initialStatus = 'ready';
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + expiryDays);
        expDateStr = expDate.toISOString().split('T')[0];

        // Hold 1 copy from shelf
        tx.dbRun(
          'UPDATE books SET available_quantity = available_quantity - 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [book_id]
        );
      } else {
        // Book is out of stock -> put in waiting queue
        const countRow = tx.dbGet(
          "SELECT COUNT(*) as count FROM reservations WHERE book_id = ? AND status = 'pending'",
          [book_id]
        );
        queuePos = (countRow ? countRow.count : 0) + 1;
      }

      const resResult = tx.dbRun(`
        INSERT INTO reservations (
          user_id, book_id, status, queue_position, expiry_date, notes
        ) VALUES (?, ?, ?, ?, ?, ?)
      `, [user_id, book_id, initialStatus, queuePos, expDateStr, notes || null]);

      // Create notification
      if (initialStatus === 'ready') {
        tx.dbRun(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'info')
        `, [
          user_id,
          'Sách đặt trước đã sẵn sàng',
          `Sách "${book.title}" bạn đặt trước đang có sẵn tại thư viện. Vui lòng đến quầy nhận sách trước ngày ${expDateStr}.`
        ]);
      } else {
        tx.dbRun(`
          INSERT INTO notifications (user_id, title, message, type)
          VALUES (?, ?, ?, 'info')
        `, [
          user_id,
          'Đặt trước sách thành công',
          `Bạn đã vào hàng chờ cho sách "${book.title}" (Vị trí #${queuePos}). Hệ thống sẽ thông báo ngay khi có người trả sách.`
        ]);
      }

      return {
        id: resResult.lastInsertRowid,
        status: initialStatus,
        queue_position: queuePos,
        expiry_date: expDateStr,
        book_title: book.title
      };
    });
  },

  cancelReservation(reservation_id, user_id, is_admin = false) {
    return dbTransaction((tx) => {
      const reservation = tx.dbGet('SELECT * FROM reservations WHERE id = ?', [reservation_id]);
      if (!reservation) throw new Error('Không tìm thấy lượt đặt trước.');

      if (!is_admin && reservation.user_id !== user_id) {
        throw new Error('Bạn không có quyền hủy lượt đặt trước này.');
      }

      if (['fulfilled', 'cancelled', 'expired'].includes(reservation.status)) {
        throw new Error(`Không thể hủy lượt đặt trước đang ở trạng thái "${reservation.status}".`);
      }

      const wasReady = reservation.status === 'ready';

      tx.dbRun(
        "UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reservation_id]
      );

      // If it was ready, either assign to next in queue or restore book copy
      if (wasReady) {
        const nextInQueue = tx.dbGet(
          "SELECT * FROM reservations WHERE book_id = ? AND status = 'pending' ORDER BY reservation_date ASC LIMIT 1",
          [reservation.book_id]
        );

        if (nextInQueue) {
          const expiryDays = parseInt(this.getSetting('reservation_expiry_days', '3'), 10);
          const expDate = new Date();
          expDate.setDate(expDate.getDate() + expiryDays);
          const expDateStr = expDate.toISOString().split('T')[0];

          tx.dbRun(
            "UPDATE reservations SET status = 'ready', expiry_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            [expDateStr, nextInQueue.id]
          );

          // Notify next user
          const b = tx.dbGet('SELECT title FROM books WHERE id = ?', [reservation.book_id]);
          tx.dbRun(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, ?, ?, 'info')
          `, [
            nextInQueue.user_id,
            'Sách đặt trước đã có sẵn',
            `Sách "${b ? b.title : ''}" bạn đặt trước đã có sẵn tại thư viện. Hạn giữ sách đến: ${expDateStr}.`
          ]);
        } else {
          // Restore book available quantity
          tx.dbRun(
            'UPDATE books SET available_quantity = available_quantity + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [reservation.book_id]
          );
        }
      }

      return { message: 'Đã hủy đặt trước sách thành công.' };
    });
  },

  fulfillReservation(reservation_id) {
    return dbTransaction((tx) => {
      const reservation = tx.dbGet('SELECT * FROM reservations WHERE id = ?', [reservation_id]);
      if (!reservation) throw new Error('Không tìm thấy lượt đặt trước.');
      if (reservation.status !== 'ready' && reservation.status !== 'pending') {
        throw new Error('Lượt đặt trước này không ở trạng thái có thể hoàn tất nhận sách.');
      }

      tx.dbRun(
        "UPDATE reservations SET status = 'fulfilled', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [reservation_id]
      );

      return { message: 'Đã hoàn tất thủ tục bàn giao sách đặt trước cho độc giả.' };
    });
  },

  getStats() {
    const pending = dbGet("SELECT COUNT(*) as count FROM reservations WHERE status = 'pending'");
    const ready = dbGet("SELECT COUNT(*) as count FROM reservations WHERE status = 'ready'");
    const fulfilled = dbGet("SELECT COUNT(*) as count FROM reservations WHERE status = 'fulfilled'");
    const total = dbGet("SELECT COUNT(*) as count FROM reservations");

    return {
      pendingCount: pending?.count || 0,
      readyCount: ready?.count || 0,
      fulfilledCount: fulfilled?.count || 0,
      totalCount: total?.count || 0
    };
  }
};

module.exports = Reservation;
