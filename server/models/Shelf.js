const { dbAll, dbGet, dbRun } = require('../config/database');

const Shelf = {
  findAll() {
    return dbAll(`
      SELECT s.*, COUNT(b.id) as book_count 
      FROM shelves s
      LEFT JOIN books b ON b.shelf_id = s.id
      GROUP BY s.id
      ORDER BY s.code ASC
    `);
  },

  findById(id) {
    return dbGet('SELECT * FROM shelves WHERE id = ?', [id]);
  },

  create({ code, name, location }) {
    return dbRun('INSERT INTO shelves (code, name, location) VALUES (?, ?, ?)', [
      code, name || null, location || null
    ]);
  },

  update(id, { code, name, location }) {
    return dbRun('UPDATE shelves SET code = ?, name = ?, location = ? WHERE id = ?', [
      code, name || null, location || null, id
    ]);
  },

  delete(id) {
    const bookCount = dbGet('SELECT COUNT(*) as count FROM books WHERE shelf_id = ?', [id]);
    if (bookCount && bookCount.count > 0) {
      throw new Error(`Không thể xóa kệ sách đang chứa ${bookCount.count} đầu sách.`);
    }
    return dbRun('DELETE FROM shelves WHERE id = ?', [id]);
  }
};

module.exports = Shelf;
