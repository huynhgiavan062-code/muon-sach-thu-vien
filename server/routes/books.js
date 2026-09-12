const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Author = require('../models/Author');
const Category = require('../models/Category');
const Publisher = require('../models/Publisher');
const Shelf = require('../models/Shelf');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/books/meta/all - Fetch dropdown metadata
router.get('/meta/all', async (req, res) => {
  try {
    const [categories, authors, publishers, shelves] = await Promise.all([
      Category.findAll(),
      Author.findAll(),
      Publisher.findAll(),
      Shelf.findAll()
    ]);
    res.json({ categories, authors, publishers, shelves });
  } catch (err) {
    console.error('Error fetching metadata:', err);
    res.status(500).json({ error: 'Lỗi tải danh mục metadata.' });
  }
});

// GET /api/books/stats - Quick stats
router.get('/stats', (req, res) => {
  try {
    const stats = Book.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error fetching book stats:', err);
    res.status(500).json({ error: 'Lỗi tải thống kê sách.' });
  }
});

// GET /api/books - List books with pagination & filters
router.get('/', (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      category_id = '',
      author_id = '',
      shelf_id = '',
      availability = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const result = Book.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      category_id,
      author_id,
      shelf_id,
      availability,
      sortBy,
      sortOrder
    });

    res.json(result);
  } catch (err) {
    console.error('Error getting books:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách sách.' });
  }
});

// GET /api/books/:id - Get single book details
router.get('/:id', (req, res) => {
  try {
    const book = Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ error: 'Không tìm thấy sách.' });
    }
    res.json({ book });
  } catch (err) {
    console.error('Error getting book detail:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin sách.' });
  }
});

// POST /api/books - Create new book (Admin only)
router.post('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const {
      book_code,
      title,
      isbn,
      author_id,
      category_id,
      publisher_id,
      shelf_id,
      publish_year,
      language,
      description,
      cover_image,
      total_quantity
    } = req.body;

    // Validation
    if (!book_code || !book_code.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập mã sách.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên sách.' });
    }

    const qty = parseInt(total_quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Số lượng sách phải là số nguyên dương lớn hơn 0.' });
    }

    // Check unique book_code
    const existing = Book.findByCode(book_code.trim());
    if (existing) {
      return res.status(400).json({ error: `Mã sách "${book_code}" đã tồn tại trên hệ thống.` });
    }

    const result = Book.create({
      book_code: book_code.trim().toUpperCase(),
      title: title.trim(),
      isbn: isbn ? isbn.trim() : null,
      author_id: author_id ? Number(author_id) : null,
      category_id: category_id ? Number(category_id) : null,
      publisher_id: publisher_id ? Number(publisher_id) : null,
      shelf_id: shelf_id ? Number(shelf_id) : null,
      publish_year: publish_year ? Number(publish_year) : null,
      language: language || 'Tiếng Việt',
      description: description ? description.trim() : null,
      cover_image: cover_image || null,
      total_quantity: qty,
      available_quantity: qty
    });

    const newBook = Book.findById(result.lastInsertRowid);
    res.status(201).json({ message: 'Thêm sách mới thành công.', book: newBook });
  } catch (err) {
    console.error('Error creating book:', err);
    res.status(500).json({ error: 'Lỗi khi thêm sách mới.' });
  }
});

// PUT /api/books/:id - Update book (Admin only)
router.put('/:id', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const bookId = req.params.id;
    const existing = Book.findById(bookId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy sách cần cập nhật.' });
    }

    const {
      title,
      isbn,
      author_id,
      category_id,
      publisher_id,
      shelf_id,
      publish_year,
      language,
      description,
      cover_image,
      total_quantity,
      available_quantity
    } = req.body;

    if (title !== undefined && !title.trim()) {
      return res.status(400).json({ error: 'Tên sách không được để trống.' });
    }

    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (isbn !== undefined) updateData.isbn = isbn ? isbn.trim() : null;
    if (author_id !== undefined) updateData.author_id = author_id ? Number(author_id) : null;
    if (category_id !== undefined) updateData.category_id = category_id ? Number(category_id) : null;
    if (publisher_id !== undefined) updateData.publisher_id = publisher_id ? Number(publisher_id) : null;
    if (shelf_id !== undefined) updateData.shelf_id = shelf_id ? Number(shelf_id) : null;
    if (publish_year !== undefined) updateData.publish_year = publish_year ? Number(publish_year) : null;
    if (language !== undefined) updateData.language = language;
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (cover_image !== undefined) updateData.cover_image = cover_image;

    if (total_quantity !== undefined) {
      const newTotal = parseInt(total_quantity, 10);
      if (isNaN(newTotal) || newTotal < 0) {
        return res.status(400).json({ error: 'Tổng số lượng không hợp lệ.' });
      }
      // Calculate borrowed copies currently
      const currentlyBorrowed = existing.total_quantity - existing.available_quantity;
      if (newTotal < currentlyBorrowed) {
        return res.status(400).json({
          error: `Không thể đặt tổng số lượng nhỏ hơn số lượng đang mượn (${currentlyBorrowed} cuốn).`
        });
      }
      updateData.total_quantity = newTotal;
      updateData.available_quantity = newTotal - currentlyBorrowed;
    }

    if (available_quantity !== undefined && total_quantity === undefined) {
      const newAvail = parseInt(available_quantity, 10);
      if (isNaN(newAvail) || newAvail < 0 || newAvail > existing.total_quantity) {
        return res.status(400).json({ error: 'Số lượng sách khả dụng không hợp lệ.' });
      }
      updateData.available_quantity = newAvail;
    }

    Book.update(bookId, updateData);
    const updatedBook = Book.findById(bookId);
    res.json({ message: 'Cập nhật thông tin sách thành công.', book: updatedBook });
  } catch (err) {
    console.error('Error updating book:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật sách.' });
  }
});

// DELETE /api/books/:id - Delete book (Admin only)
router.delete('/:id', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const bookId = req.params.id;
    const existing = Book.findById(bookId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy sách cần xóa.' });
    }

    Book.delete(bookId);
    res.json({ message: `Đã xóa sách "${existing.title}" thành công.` });
  } catch (err) {
    console.error('Error deleting book:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi xóa sách.' });
  }
});

module.exports = router;
