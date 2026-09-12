const { dbAll, dbGet, dbRun } = require('../config/database');

const Book = {
  findAll({
    page = 1,
    limit = 10,
    search = '',
    category_id = '',
    author_id = '',
    shelf_id = '',
    availability = '',
    sortBy = 'created_at',
    sortOrder = 'DESC'
  } = {}) {
    const where = [];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      where.push(`(
        b.title LIKE ? OR 
        b.book_code LIKE ? OR 
        b.isbn LIKE ? OR 
        a.name LIKE ?
      )`);
      params.push(s, s, s, s);
    }

    if (category_id) {
      where.push("b.category_id = ?");
      params.push(Number(category_id));
    }

    if (author_id) {
      where.push("b.author_id = ?");
      params.push(Number(author_id));
    }

    if (shelf_id) {
      where.push("b.shelf_id = ?");
      params.push(Number(shelf_id));
    }

    if (availability === 'available') {
      where.push("b.available_quantity > 0");
    } else if (availability === 'out_of_stock') {
      where.push("b.available_quantity = 0");
    }

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const allowedSort = ['title', 'book_code', 'publish_year', 'available_quantity', 'created_at'];
    const sortField = allowedSort.includes(sortBy) ? `b.${sortBy}` : 'b.created_at';
    const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count total matching
    const countSql = `
      SELECT COUNT(*) as total 
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      ${whereClause}
    `;
    const countResult = dbGet(countSql, params);
    const total = countResult ? countResult.total : 0;

    const offset = (Number(page) - 1) * Number(limit);
    const sql = `
      SELECT 
        b.id, b.book_code, b.title, b.isbn, b.publish_year, b.language,
        b.description, b.cover_image, b.total_quantity, b.available_quantity,
        b.created_at, b.updated_at,
        b.author_id, a.name as author_name,
        b.category_id, c.name as category_name,
        b.publisher_id, p.name as publisher_name,
        b.shelf_id, s.code as shelf_code, s.name as shelf_name, s.location as shelf_location
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN publishers p ON b.publisher_id = p.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      ${whereClause}
      ORDER BY ${sortField} ${order}
      LIMIT ? OFFSET ?
    `;

    const books = dbAll(sql, [...params, Number(limit), offset]);

    return {
      data: books,
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
        b.*,
        a.name as author_name, a.biography as author_bio,
        c.name as category_name, c.description as category_desc,
        p.name as publisher_name, p.address as publisher_address, p.phone as publisher_phone,
        s.code as shelf_code, s.name as shelf_name, s.location as shelf_location
      FROM books b
      LEFT JOIN authors a ON b.author_id = a.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN publishers p ON b.publisher_id = p.id
      LEFT JOIN shelves s ON b.shelf_id = s.id
      WHERE b.id = ?
    `;
    return dbGet(sql, [id]);
  },

  findByCode(book_code) {
    return dbGet('SELECT * FROM books WHERE book_code = ?', [book_code]);
  },

  create({
    book_code,
    title,
    isbn,
    author_id,
    category_id,
    publisher_id,
    shelf_id,
    publish_year,
    language = 'Tiếng Việt',
    description,
    cover_image,
    total_quantity = 1,
    available_quantity
  }) {
    const avail = available_quantity !== undefined ? available_quantity : total_quantity;
    return dbRun(
      `INSERT INTO books (
        book_code, title, isbn, author_id, category_id, publisher_id,
        shelf_id, publish_year, language, description, cover_image,
        total_quantity, available_quantity
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        book_code, title, isbn, author_id || null, category_id || null,
        publisher_id || null, shelf_id || null, publish_year || null,
        language, description || null, cover_image || null,
        Number(total_quantity), Number(avail)
      ]
    );
  },

  update(id, fields) {
    const allowed = [
      'title', 'isbn', 'author_id', 'category_id', 'publisher_id',
      'shelf_id', 'publish_year', 'language', 'description', 'cover_image',
      'total_quantity', 'available_quantity'
    ];
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

    return dbRun(`UPDATE books SET ${sets.join(', ')} WHERE id = ?`, params);
  },

  delete(id) {
    // Check if book has active borrow records
    const activeBorrow = dbGet(`
      SELECT COUNT(*) as count 
      FROM borrow_details bd
      JOIN borrow_records br ON bd.borrow_record_id = br.id
      WHERE bd.book_id = ? AND br.status IN ('borrowing', 'overdue')
    `, [id]);

    if (activeBorrow && activeBorrow.count > 0) {
      throw new Error('Không thể xóa sách đang có người mượn.');
    }

    return dbRun('DELETE FROM books WHERE id = ?', [id]);
  },

  getStats() {
    const totalTitles = dbGet('SELECT COUNT(*) as count FROM books');
    const totalCopies = dbGet('SELECT SUM(total_quantity) as total, SUM(available_quantity) as available FROM books');
    const categoriesCount = dbGet('SELECT COUNT(*) as count FROM categories');
    const authorsCount = dbGet('SELECT COUNT(*) as count FROM authors');

    return {
      totalTitles: totalTitles?.count || 0,
      totalCopies: totalCopies?.total || 0,
      availableCopies: totalCopies?.available || 0,
      borrowedCopies: (totalCopies?.total || 0) - (totalCopies?.available || 0),
      categoriesCount: categoriesCount?.count || 0,
      authorsCount: authorsCount?.count || 0
    };
  }
};

module.exports = Book;
