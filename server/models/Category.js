const { dbAll, dbGet, dbRun } = require('../config/database');

const Category = {
  findAll() {
    return dbAll(`
      SELECT c.*, COUNT(b.id) as book_count 
      FROM categories c
      LEFT JOIN books b ON b.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
  },

  findById(id) {
    return dbGet('SELECT * FROM categories WHERE id = ?', [id]);
  },

  create({ name, description }) {
    return dbRun('INSERT INTO categories (name, description) VALUES (?, ?)', [name, description || null]);
  },

  update(id, { name, description }) {
    return dbRun('UPDATE categories SET name = ?, description = ? WHERE id = ?', [name, description || null, id]);
  },

  delete(id) {
    const bookCount = dbGet('SELECT COUNT(*) as count FROM books WHERE category_id = ?', [id]);
    if (bookCount && bookCount.count > 0) {
      throw new Error(`Không thể xóa danh mục đang có ${bookCount.count} đầu sách.`);
    }
    return dbRun('DELETE FROM categories WHERE id = ?', [id]);
  }
};

module.exports = Category;
