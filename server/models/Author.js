const { dbAll, dbGet, dbRun } = require('../config/database');

const Author = {
  findAll() {
    return dbAll(`
      SELECT a.*, COUNT(b.id) as book_count 
      FROM authors a
      LEFT JOIN books b ON b.author_id = a.id
      GROUP BY a.id
      ORDER BY a.name ASC
    `);
  },

  findById(id) {
    return dbGet('SELECT * FROM authors WHERE id = ?', [id]);
  },

  create({ name, biography }) {
    return dbRun('INSERT INTO authors (name, biography) VALUES (?, ?)', [name, biography || null]);
  },

  update(id, { name, biography }) {
    return dbRun('UPDATE authors SET name = ?, biography = ? WHERE id = ?', [name, biography || null, id]);
  },

  delete(id) {
    const bookCount = dbGet('SELECT COUNT(*) as count FROM books WHERE author_id = ?', [id]);
    if (bookCount && bookCount.count > 0) {
      throw new Error(`Không thể xóa tác giả đang có ${bookCount.count} đầu sách.`);
    }
    return dbRun('DELETE FROM authors WHERE id = ?', [id]);
  }
};

module.exports = Author;
