const { dbAll, dbGet, dbRun } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = {
  findByUsername(username) {
    return dbGet('SELECT * FROM users WHERE username = ?', [username]);
  },

  findByEmail(email) {
    return dbGet('SELECT * FROM users WHERE email = ?', [email]);
  },

  findByReaderCode(reader_code) {
    return dbGet('SELECT * FROM users WHERE reader_code = ?', [reader_code]);
  },

  findById(id) {
    return dbGet(
      `SELECT id, username, email, full_name, phone, role, status, reader_code,
              avatar, address, date_of_birth, created_at, updated_at
       FROM users WHERE id = ?`,
      [id]
    );
  },

  generateNextReaderCode() {
    const last = dbGet("SELECT reader_code FROM users WHERE reader_code LIKE 'DG-%' ORDER BY id DESC LIMIT 1");
    if (!last || !last.reader_code) {
      return 'DG-001';
    }
    const match = last.reader_code.match(/^DG-(\d+)$/);
    if (!match) {
      return `DG-${Date.now().toString().slice(-4)}`;
    }
    const nextNum = parseInt(match[1], 10) + 1;
    return `DG-${String(nextNum).padStart(3, '0')}`;
  },

  findAll({ page = 1, limit = 10, search = '', role = '', status = '' } = {}) {
    let where = [];
    let params = [];

    if (search && search.trim()) {
      where.push("(u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ? OR u.reader_code LIKE ? OR u.phone LIKE ?)");
      const s = `%${search.trim()}%`;
      params.push(s, s, s, s, s);
    }
    if (role) {
      where.push("u.role = ?");
      params.push(role);
    }
    if (status) {
      where.push("u.status = ?");
      params.push(status);
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const countResult = dbGet(`SELECT COUNT(*) as total FROM users u ${whereClause}`, params);
    const total = countResult ? countResult.total : 0;

    const offset = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT 
        u.id, u.username, u.email, u.full_name, u.phone, u.role, u.status,
        u.reader_code, u.address, u.date_of_birth, u.created_at, u.updated_at,
        (
          SELECT COUNT(*) 
          FROM borrow_records br 
          WHERE br.user_id = u.id AND br.status IN ('borrowing', 'overdue')
        ) as active_borrows_count,
        (
          SELECT COALESCE(SUM(f.amount - f.paid_amount), 0)
          FROM fines f
          WHERE f.user_id = u.id AND f.status = 'unpaid'
        ) as unpaid_fines
      FROM users u
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const users = dbAll(sql, [...params, Number(limit), offset]);

    return {
      data: users,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  getReaderDetails(id) {
    const user = this.findById(id);
    if (!user) return null;

    // Active borrow records
    const activeBorrows = dbAll(`
      SELECT 
        br.id as borrow_id, br.borrow_code, br.borrow_date, br.due_date, br.status, br.renewal_count,
        b.id as book_id, b.book_code, b.title, b.cover_image,
        bd.quantity, bd.condition_note
      FROM borrow_records br
      JOIN borrow_details bd ON br.id = bd.borrow_record_id
      JOIN books b ON bd.book_id = b.id
      WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
      ORDER BY br.due_date ASC
    `, [id]);

    // Past borrow history
    const borrowHistory = dbAll(`
      SELECT 
        br.id as borrow_id, br.borrow_code, br.borrow_date, br.due_date, br.return_date, br.status,
        b.id as book_id, b.book_code, b.title,
        bd.quantity
      FROM borrow_records br
      JOIN borrow_details bd ON br.id = bd.borrow_record_id
      JOIN books b ON bd.book_id = b.id
      WHERE br.user_id = ? AND br.status = 'returned'
      ORDER BY br.return_date DESC
      LIMIT 10
    `, [id]);

    // Fines
    const fines = dbAll(`
      SELECT 
        f.id, f.reason, f.overdue_days, f.amount, f.paid_amount, f.status, f.paid_date, f.created_at,
        b.title as book_title, br.borrow_code
      FROM fines f
      LEFT JOIN books b ON f.book_id = b.id
      LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [id]);

    const unpaidFinesTotal = fines
      .filter(f => f.status === 'unpaid' || f.status === 'partial')
      .reduce((sum, f) => sum + (f.amount - f.paid_amount), 0);

    return {
      user,
      activeBorrows,
      borrowHistory,
      fines,
      stats: {
        activeBorrowsCount: activeBorrows.length,
        totalHistoryCount: borrowHistory.length,
        unpaidFinesTotal
      }
    };
  },

  create({ username, email, password, full_name, phone, role = 'user', reader_code, address, date_of_birth }) {
    const password_hash = bcrypt.hashSync(password, 10);
    const assignedReaderCode = role === 'user' ? (reader_code || this.generateNextReaderCode()) : null;

    return dbRun(
      `INSERT INTO users (username, email, password_hash, full_name, phone, role, reader_code, address, date_of_birth)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [username, email, password_hash, full_name, phone || null, role, assignedReaderCode, address || null, date_of_birth || null]
    );
  },

  update(id, fields) {
    const allowed = ['full_name', 'phone', 'email', 'status', 'address', 'date_of_birth', 'avatar', 'reader_code', 'role'];
    const sets = [];
    const params = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (sets.length === 0) return { changes: 0 };

    sets.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    return dbRun(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  updatePassword(id, newPassword) {
    const password_hash = bcrypt.hashSync(newPassword, 10);
    return dbRun('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [password_hash, id]);
  },

  updateStatus(id, status) {
    return dbRun('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [status, id]);
  },

  delete(id) {
    // Check if user has active borrows
    const active = dbGet(`
      SELECT COUNT(*) as count 
      FROM borrow_records 
      WHERE user_id = ? AND status IN ('borrowing', 'overdue')
    `, [id]);

    if (active && active.count > 0) {
      throw new Error(`Không thể xóa người dùng đang có ${active.count} lượt mượn sách chưa hoàn trả.`);
    }

    // Check if user has unpaid fines
    const unpaid = dbGet(`
      SELECT COUNT(*) as count 
      FROM fines 
      WHERE user_id = ? AND status = 'unpaid'
    `, [id]);

    if (unpaid && unpaid.count > 0) {
      throw new Error('Không thể xóa người dùng đang có tiền phạt chưa thanh toán.');
    }

    return dbRun('DELETE FROM users WHERE id = ?', [id]);
  },

  verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  },

  getStats() {
    const totalUsers = dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'user'");
    const activeUsers = dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'user' AND status = 'active'");
    const lockedUsers = dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'user' AND status = 'locked'");
    const admins = dbGet("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");

    return {
      totalReaders: totalUsers?.count || 0,
      activeReaders: activeUsers?.count || 0,
      lockedReaders: lockedUsers?.count || 0,
      totalAdmins: admins?.count || 0
    };
  }
};

module.exports = User;
