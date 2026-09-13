const express = require('express');
const router = express.Router();
const Borrow = require('../models/Borrow');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/borrow/stats - Borrow statistics (Admin only)
router.get('/stats', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const stats = Borrow.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting borrow stats:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê mượn trả.' });
  }
});

// GET /api/borrow/active-by-book - Find active borrow record by scanned book code or ISBN
router.get('/active-by-book', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { code } = req.query;
    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã sách hoặc ISBN.' });
    }
    const record = Borrow.findActiveByBook(code.trim());
    if (!record) {
      return res.status(404).json({ error: `Không tìm thấy phiếu mượn đang hoạt động nào cho ấn phẩm "${code}".` });
    }
    res.json({ record });
  } catch (err) {
    console.error('Error finding active borrow by book:', err);
    res.status(500).json({ error: 'Lỗi khi tra cứu phiếu mượn theo mã sách.' });
  }
});

// GET /api/borrow/my-active - Logged-in user's active borrows
router.get('/my-active', authMiddleware, (req, res) => {
  try {
    const result = Borrow.findAll({
      user_id: req.user.id,
      limit: 50
    });
    const active = result.data.filter(r => r.status === 'borrowing' || r.status === 'overdue');
    res.json({ data: active });
  } catch (err) {
    console.error('Error getting my active borrows:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách sách đang mượn.' });
  }
});

// GET /api/borrow/my-history - Logged-in user's past borrows
router.get('/my-history', authMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const result = Borrow.findAll({
      user_id: req.user.id,
      status: 'returned',
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
    res.json(result);
  } catch (err) {
    console.error('Error getting my borrow history:', err);
    res.status(500).json({ error: 'Lỗi khi tải lịch sử mượn sách.' });
  }
});

// GET /api/borrow - All borrow records (Admin only)
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

    const result = Borrow.findAll({
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
    console.error('Error getting borrow records:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách phiếu mượn.' });
  }
});

// GET /api/borrow/:id - Single borrow record detail
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    const record = Borrow.findById(recordId);

    if (!record) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu mượn.' });
    }

    // Allow admin or the owner user
    if (req.user.role !== 'admin' && req.user.id !== record.user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền xem phiếu mượn này.' });
    }

    res.json({ record });
  } catch (err) {
    console.error('Error getting borrow record:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin phiếu mượn.' });
  }
});

// GET /api/borrow/eligibility/:bookId - Check if current user is eligible to borrow a book
router.get('/eligibility/:bookId', authMiddleware, (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (!bookId || isNaN(bookId)) {
      return res.status(400).json({ error: 'Mã sách không hợp lệ.' });
    }
    const eligibility = Borrow.checkEligibility(req.user.id, bookId);
    res.json({ eligibility });
  } catch (err) {
    console.error('Error checking borrow eligibility:', err);
    res.status(500).json({ error: 'Lỗi khi kiểm tra điều kiện mượn sách.' });
  }
});

// POST /api/borrow - Create borrow record (User or Admin)
router.post('/', authMiddleware, (req, res) => {
  try {
    const { user_id, book_ids, notes, custom_due_date } = req.body;
    const isAdmin = req.user.role === 'admin';

    // If regular user, enforce self-borrowing and standard due date
    const targetUserId = isAdmin ? Number(user_id) : req.user.id;
    const adminId = isAdmin ? req.user.id : null;
    const borrowNotes = isAdmin ? notes : (notes || 'Độc giả tự tạo phiếu mượn qua hệ thống');
    const dueDate = isAdmin ? custom_due_date : null;

    if (!targetUserId) {
      return res.status(400).json({ error: 'Vui lòng cung cấp mã độc giả.' });
    }

    const result = Borrow.borrowBooks({
      user_id: targetUserId,
      admin_id: adminId,
      book_ids: Array.isArray(book_ids) ? book_ids.map(Number) : [],
      notes: borrowNotes,
      custom_due_date: dueDate
    });

    const fullRecord = Borrow.findById(result.id);
    res.status(201).json({
      message: `Mượn sách thành công! Mã phiếu: ${result.borrow_code}.`,
      record: fullRecord
    });
  } catch (err) {
    console.error('Error creating borrow record:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi tạo phiếu mượn.' });
  }
});

// POST /api/borrow/:id/return - Return books (Admin only)
router.post('/:id/return', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    const { condition_notes } = req.body;

    const result = Borrow.returnBooks({
      borrow_record_id: recordId,
      admin_id: req.user.id,
      condition_notes
    });

    let msg = `Đã hoàn tất trả sách cho phiếu ${result.borrow_code}.`;
    if (result.fine_amount > 0) {
      msg += ` Phiếu quá hạn ${result.overdue_days} ngày, phát sinh tiền phạt: ${result.fine_amount.toLocaleString('vi-VN')} đ.`;
    }

    const updatedRecord = Borrow.findById(recordId);
    res.json({
      message: msg,
      record: updatedRecord,
      returnDetails: result
    });
  } catch (err) {
    console.error('Error returning books:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi trả sách.' });
  }
});

// POST /api/borrow/:id/renew - Renew borrow record
router.post('/:id/renew', authMiddleware, (req, res) => {
  try {
    const recordId = parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'admin';

    const result = Borrow.renewBorrow(recordId, req.user.id, isAdmin);
    const updatedRecord = Borrow.findById(recordId);

    res.json({
      message: `Gia hạn thành công. Hạn trả mới: ${result.new_due_date} (Lần ${result.renewal_count}/${result.max_renewals}).`,
      renewal: result,
      record: updatedRecord
    });
  } catch (err) {
    console.error('Error renewing borrow record:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi gia hạn sách.' });
  }
});

module.exports = router;
