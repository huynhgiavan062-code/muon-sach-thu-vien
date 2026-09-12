const { dbAll, dbGet, dbRun } = require('../config/database');

const Notification = {
  findAll({
    user_id,
    page = 1,
    limit = 20,
    is_read = ''
  } = {}) {
    const where = ['user_id = ?'];
    const params = [Number(user_id)];

    if (is_read !== '' && is_read !== undefined && is_read !== null) {
      where.push('is_read = ?');
      params.push(Number(is_read));
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;

    const countSql = `SELECT COUNT(*) as count FROM notifications ${whereClause}`;
    const totalRow = dbGet(countSql, params);
    const total = totalRow ? totalRow.count : 0;

    const unreadRow = dbGet('SELECT COUNT(*) as unread FROM notifications WHERE user_id = ? AND is_read = 0', [Number(user_id)]);
    const unreadCount = unreadRow ? unreadRow.unread : 0;

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);
    const querySql = `
      SELECT * 
      FROM notifications 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;

    const data = dbAll(querySql, [...params, Number(limit), offset]);

    return {
      data,
      unreadCount,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    };
  },

  getUnreadCount(user_id) {
    const row = dbGet('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [Number(user_id)]);
    return row ? row.count : 0;
  },

  create({ user_id, title, message, type = 'info', link = null }) {
    if (!user_id || !title || !message) {
      throw new Error('user_id, title và message là bắt buộc.');
    }

    const res = dbRun(`
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (?, ?, ?, ?, ?)
    `, [Number(user_id), title.trim(), message.trim(), type, link]);

    return {
      id: res.lastInsertRowid,
      user_id: Number(user_id),
      title: title.trim(),
      message: message.trim(),
      type,
      link,
      is_read: 0,
      created_at: new Date().toISOString()
    };
  },

  markAsRead(id, user_id) {
    dbRun(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE id = ? AND user_id = ?
    `, [Number(id), Number(user_id)]);
    return true;
  },

  markAllAsRead(user_id) {
    dbRun(`
      UPDATE notifications 
      SET is_read = 1 
      WHERE user_id = ? AND is_read = 0
    `, [Number(user_id)]);
    return true;
  },

  delete(id, user_id) {
    dbRun(`
      DELETE FROM notifications 
      WHERE id = ? AND user_id = ?
    `, [Number(id), Number(user_id)]);
    return true;
  }
};

module.exports = Notification;
