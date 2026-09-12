const { dbAll, dbGet, dbRun } = require('../config/database');

const Publisher = {
  findAll() {
    return dbAll(`
      SELECT p.*, COUNT(b.id) as book_count 
      FROM publishers p
      LEFT JOIN books b ON b.publisher_id = p.id
      GROUP BY p.id
      ORDER BY p.name ASC
    `);
  },

  findById(id) {
    return dbGet('SELECT * FROM publishers WHERE id = ?', [id]);
  },

  create({ name, address, phone, email }) {
    return dbRun('INSERT INTO publishers (name, address, phone, email) VALUES (?, ?, ?, ?)', [
      name, address || null, phone || null, email || null
    ]);
  },

  update(id, { name, address, phone, email }) {
    return dbRun('UPDATE publishers SET name = ?, address = ?, phone = ?, email = ? WHERE id = ?', [
      name, address || null, phone || null, email || null, id
    ]);
  },

  delete(id) {
    const bookCount = dbGet('SELECT COUNT(*) as count FROM books WHERE publisher_id = ?', [id]);
    if (bookCount && bookCount.count > 0) {
      throw new Error(`Không thể xóa nhà xuất bản đang có ${bookCount.count} đầu sách.`);
    }
    return dbRun('DELETE FROM publishers WHERE id = ?', [id]);
  }
};

module.exports = Publisher;
