const express = require('express');
const router = express.Router();
const Fine = require('../models/Fine');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/fines/stats - Fine statistics (Admin only)
router.get('/stats', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const stats = Fine.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting fine stats:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê tiền phạt.' });
  }
});

// GET /api/fines/my - User's own fines
router.get('/my', authMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const result = Fine.findAll({
      user_id: req.user.id,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      status
    });
    res.json(result);
  } catch (err) {
    console.error('Error getting my fines:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách tiền phạt của bạn.' });
  }
});

// GET /api/fines - List all fines (Admin only)
router.get('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      user_id = '',
      from_date = '',
      to_date = ''
    } = req.query;

    const result = Fine.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status,
      user_id,
      from_date,
      to_date
    });

    res.json(result);
  } catch (err) {
    console.error('Error getting fines list:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách tiền phạt.' });
  }
});

// GET /api/fines/:id - Single fine details
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const fineId = parseInt(req.params.id, 10);
    const fine = Fine.findById(fineId);

    if (!fine) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin phiếu phạt.' });
    }

    if (req.user.role !== 'admin' && req.user.id !== fine.user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền xem phiếu phạt này.' });
    }

    res.json({ fine });
  } catch (err) {
    console.error('Error getting fine details:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin phiếu phạt.' });
  }
});

// POST /api/fines - Create new fine (Admin only)
router.post('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { user_id, borrow_record_id, book_id, reason, amount, overdue_days, notes } = req.body;

    const result = Fine.createFine({
      user_id: Number(user_id),
      borrow_record_id: borrow_record_id ? Number(borrow_record_id) : null,
      book_id: book_id ? Number(book_id) : null,
      reason,
      amount: Number(amount),
      overdue_days: Number(overdue_days) || 0,
      notes
    });

    const fullFine = Fine.findById(result.id);
    res.status(201).json({
      message: 'Tạo phiếu phạt thành công.',
      fine: fullFine
    });
  } catch (err) {
    console.error('Error creating fine:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi tạo phiếu phạt.' });
  }
});

// POST /api/fines/:id/pay - Collect fine payment (Admin only, or user paying their fine)
router.post('/:id/pay', authMiddleware, (req, res) => {
  try {
    const fineId = parseInt(req.params.id, 10);
    const fine = Fine.findById(fineId);

    if (!fine) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu phạt.' });
    }

    // Only admin or the fine owner can pay
    if (req.user.role !== 'admin' && req.user.id !== fine.user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thanh toán này.' });
    }

    const { amount, payment_method, notes } = req.body;
    const payment = Fine.payFine({
      fine_id: fineId,
      amount,
      payment_method: payment_method || (req.user.role === 'admin' ? 'Tiền mặt' : 'Chuyển khoản'),
      notes,
      admin_id: req.user.role === 'admin' ? req.user.id : null
    });

    const updatedFine = Fine.findById(fineId);
    res.json({
      message: `Đã thu ${Number(amount).toLocaleString('vi-VN')} đ cho phiếu phạt thành công.`,
      payment,
      fine: updatedFine
    });
  } catch (err) {
    console.error('Error paying fine:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi thanh toán tiền phạt.' });
  }
});

module.exports = router;
