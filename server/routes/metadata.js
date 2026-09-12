const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const Author = require('../models/Author');
const Publisher = require('../models/Publisher');
const Shelf = require('../models/Shelf');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// ==================== CATEGORIES ====================
router.get('/categories', (req, res) => {
  try {
    const list = Category.findAll();
    res.json({ categories: list });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải danh mục.' });
  }
});

router.post('/categories', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên danh mục.' });
    const result = Category.create({ name: name.trim(), description: description ? description.trim() : '' });
    res.status(201).json({ message: 'Tạo danh mục thành công.', category: Category.findById(result.lastInsertRowid) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi khi tạo danh mục.' });
  }
});

// ==================== AUTHORS ====================
router.get('/authors', (req, res) => {
  try {
    const list = Author.findAll();
    res.json({ authors: list });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải danh sách tác giả.' });
  }
});

router.post('/authors', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { name, biography } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên tác giả.' });
    const result = Author.create({ name: name.trim(), biography: biography ? biography.trim() : '' });
    res.status(201).json({ message: 'Tạo tác giả thành công.', author: Author.findById(result.lastInsertRowid) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi khi tạo tác giả.' });
  }
});

// ==================== PUBLISHERS ====================
router.get('/publishers', (req, res) => {
  try {
    const list = Publisher.findAll();
    res.json({ publishers: list });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải danh sách NXB.' });
  }
});

router.post('/publishers', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { name, address, phone, email } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Vui lòng nhập tên nhà xuất bản.' });
    const result = Publisher.create({ name: name.trim(), address, phone, email });
    res.status(201).json({ message: 'Tạo NXB thành công.', publisher: Publisher.findById(result.lastInsertRowid) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi khi tạo NXB.' });
  }
});

// ==================== SHELVES ====================
router.get('/shelves', (req, res) => {
  try {
    const list = Shelf.findAll();
    res.json({ shelves: list });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tải danh sách kệ sách.' });
  }
});

router.post('/shelves', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { code, name, location } = req.body;
    if (!code || !code.trim()) return res.status(400).json({ error: 'Vui lòng nhập mã kệ sách.' });
    const result = Shelf.create({ code: code.trim().toUpperCase(), name, location });
    res.status(201).json({ message: 'Tạo kệ sách thành công.', shelf: Shelf.findById(result.lastInsertRowid) });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Lỗi khi tạo kệ sách.' });
  }
});

module.exports = router;
