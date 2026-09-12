const { dbAll, dbGet, dbRun, dbTransaction } = require('../config/database');

const Fine = {
  findAll({
    page = 1,
    limit = 10,
    search = '',
    status = '',
    user_id = '',
    from_date = '',
    to_date = ''
  } = {}) {
    const where = [];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      where.push(`(
        u.reader_code LIKE ? OR 
        u.full_name LIKE ? OR 
        u.username LIKE ? OR 
        br.borrow_code LIKE ? OR 
        b.title LIKE ? OR 
        f.reason LIKE ?
      )`);
      params.push(s, s, s, s, s, s);
    }

    if (status && status.trim()) {
      where.push('f.status = ?');
      params.push(status.trim());
    }

    if (user_id) {
      where.push('f.user_id = ?');
      params.push(Number(user_id));
    }

    if (from_date) {
      where.push('DATE(f.created_at) >= ?');
      params.push(from_date);
    }

    if (to_date) {
      where.push('DATE(f.created_at) <= ?');
      params.push(to_date);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    // Total count
    const countSql = `
      SELECT COUNT(*) as count 
      FROM fines f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
      LEFT JOIN books b ON f.book_id = b.id
      ${whereClause}
    `;
    const totalRow = dbGet(countSql, params);
    const total = totalRow ? totalRow.count : 0;

    // Aggregate statistics for this query
    const statsSql = `
      SELECT 
        COALESCE(SUM(f.amount), 0) as total_amount,
        COALESCE(SUM(f.paid_amount), 0) as total_paid,
        COALESCE(SUM(CASE WHEN f.status != 'paid' THEN (f.amount - f.paid_amount) ELSE 0 END), 0) as total_unpaid
      FROM fines f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
      LEFT JOIN books b ON f.book_id = b.id
      ${whereClause}
    `;
    const summary = dbGet(statsSql, params) || { total_amount: 0, total_paid: 0, total_unpaid: 0 };

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const querySql = `
      SELECT 
        f.*,
        u.full_name as reader_name,
        u.reader_code,
        u.username,
        u.email,
        u.phone,
        br.borrow_code,
        br.borrow_date,
        br.due_date,
        b.title as book_title,
        b.book_code
      FROM fines f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
      LEFT JOIN books b ON f.book_id = b.id
      ${whereClause}
      ORDER BY f.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const data = dbAll(querySql, [...params, Number(limit), offset]);

    return {
      data,
      summary,
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
        f.*,
        u.full_name as reader_name,
        u.reader_code,
        u.username,
        u.email,
        u.phone,
        br.borrow_code,
        br.borrow_date,
        br.due_date,
        br.return_date,
        b.title as book_title,
        b.book_code
      FROM fines f
      JOIN users u ON f.user_id = u.id
      LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
      LEFT JOIN books b ON f.book_id = b.id
      WHERE f.id = ?
    `;
    return dbGet(sql, [id]);
  },

  getStats() {
    const row = dbGet(`
      SELECT 
        COUNT(*) as total_fines,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN (amount - paid_amount) ELSE 0 END), 0) as total_unpaid,
        COUNT(CASE WHEN status = 'unpaid' THEN 1 END) as count_unpaid,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as count_paid,
        COUNT(CASE WHEN status = 'partial' THEN 1 END) as count_partial,
        COUNT(DISTINCT CASE WHEN status != 'paid' THEN user_id END) as readers_with_fines
      FROM fines
    `);

    return row || {
      total_fines: 0,
      total_amount: 0,
      total_collected: 0,
      total_unpaid: 0,
      count_unpaid: 0,
      count_paid: 0,
      count_partial: 0,
      readers_with_fines: 0
    };
  },

  createFine({ user_id, borrow_record_id = null, book_id = null, reason, amount, overdue_days = 0, notes = '' }) {
    if (!user_id) throw new Error('Vui lòng chọn độc giả cần lập phiếu phạt.');
    if (!reason || !reason.trim()) throw new Error('Vui lòng nhập lý do phạt.');
    if (isNaN(amount) || Number(amount) <= 0) throw new Error('Số tiền phạt phải lớn hơn 0.');

    const user = dbGet('SELECT id, full_name FROM users WHERE id = ?', [user_id]);
    if (!user) throw new Error('Không tìm thấy độc giả.');

    return dbTransaction(tx => {
      const res = tx.dbRun(`
        INSERT INTO fines (
          borrow_record_id, user_id, book_id, reason, overdue_days, amount, paid_amount, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, 0, 'unpaid', ?)
      `, [
        borrow_record_id || null,
        user_id,
        book_id || null,
        reason.trim(),
        Number(overdue_days) || 0,
        Number(amount),
        notes ? notes.trim() : null
      ]);

      const fineId = res.lastInsertRowid;

      // In-app notification
      tx.dbRun(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'warning')
      `, [
        user_id,
        'Thông báo phát sinh tiền phạt',
        `Bạn có một khoản phạt mới: "${reason.trim()}". Số tiền: ${Number(amount).toLocaleString('vi-VN')} đ. Vui lòng thanh toán tại quầy thư viện.`
      ]);

      return {
        id: fineId,
        user_id,
        amount: Number(amount),
        reason: reason.trim()
      };
    });
  },

  payFine({ fine_id, amount, payment_method = 'Tiền mặt', notes = '', admin_id = null }) {
    const fine = this.findById(fine_id);
    if (!fine) throw new Error('Không tìm thấy phiếu phạt.');

    if (fine.status === 'paid') {
      throw new Error('Khoản phạt này đã được thanh toán đầy đủ.');
    }

    const payAmount = Number(amount);
    if (isNaN(payAmount) || payAmount <= 0) {
      throw new Error('Số tiền thanh toán phải lớn hơn 0.');
    }

    const remaining = fine.amount - fine.paid_amount;
    if (payAmount > remaining) {
      throw new Error(`Số tiền nộp (${payAmount.toLocaleString('vi-VN')} đ) vượt quá số tiền còn nợ (${remaining.toLocaleString('vi-VN')} đ).`);
    }

    return dbTransaction(tx => {
      const newPaidAmount = fine.paid_amount + payAmount;
      const isFull = newPaidAmount >= fine.amount;
      const newStatus = isFull ? 'paid' : 'partial';
      const paidDate = new Date().toISOString();

      const paymentNote = `[${new Date().toLocaleDateString('vi-VN')}]: Thu ${payAmount.toLocaleString('vi-VN')} đ qua ${payment_method}${notes ? ` (${notes})` : ''}`;
      const combinedNotes = fine.notes ? `${fine.notes}\n${paymentNote}` : paymentNote;

      tx.dbRun(`
        UPDATE fines 
        SET 
          paid_amount = ?,
          status = ?,
          paid_date = ?,
          notes = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [newPaidAmount, newStatus, paidDate, combinedNotes, fine_id]);

      // Notification to user
      const notifyMsg = isFull
        ? `Khoản phạt "${fine.reason}" số tiền ${fine.amount.toLocaleString('vi-VN')} đ đã được thanh toán hoàn tất (Phương thức: ${payment_method}). Cảm ơn bạn!`
        : `Bạn đã nộp ${payAmount.toLocaleString('vi-VN')} đ cho khoản phạt "${fine.reason}". Số tiền còn lại: ${(fine.amount - newPaidAmount).toLocaleString('vi-VN')} đ.`;

      tx.dbRun(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
      `, [
        fine.user_id,
        isFull ? 'Thanh toán tiền phạt hoàn tất' : 'Xác nhận nộp phạt một phần',
        notifyMsg,
        isFull ? 'success' : 'info'
      ]);

      return {
        fine_id,
        paid_amount: payAmount,
        total_paid: newPaidAmount,
        remaining: fine.amount - newPaidAmount,
        status: newStatus,
        payment_method,
        paid_date: paidDate
      };
    });
  }
};

module.exports = Fine;
