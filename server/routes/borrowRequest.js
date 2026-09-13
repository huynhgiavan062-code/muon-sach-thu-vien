const express = require('express');
const router = express.Router();
const BorrowRequest = require('../models/BorrowRequest');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/borrow-requests/stats - Pending request statistics (Admin only)
router.get('/stats', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const stats = BorrowRequest.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting borrow request stats:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê yêu cầu mượn sách.' });
  }
});

// GET /api/borrow-requests - List requests
router.get('/', authMiddleware, (req, res) => {
  try {
    const { status, search, page = 1, limit = 10 } = req.query;
    const isAdmin = req.user.role === 'admin';

    // If regular user, only view own requests
    const userId = isAdmin ? req.query.user_id : req.user.id;

    const result = BorrowRequest.findAll({
      status,
      user_id: userId,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });

    res.json(result);
  } catch (err) {
    console.error('Error getting borrow requests:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách yêu cầu mượn sách.' });
  }
});

// GET /api/borrow-requests/:id - Single request detail
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const request = BorrowRequest.findById(requestId);

    if (!request) {
      return res.status(404).json({ error: 'Không tìm thấy yêu cầu mượn sách.' });
    }

    if (req.user.role !== 'admin' && req.user.id !== request.user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền xem yêu cầu này.' });
    }

    res.json({ request });
  } catch (err) {
    console.error('Error getting borrow request detail:', err);
    res.status(500).json({ error: 'Lỗi khi tải chi tiết yêu cầu mượn sách.' });
  }
});

// POST /api/borrow-requests - User creates a new borrow request
router.post('/', authMiddleware, (req, res) => {
  try {
    const { book_id } = req.body;
    if (!book_id) {
      return res.status(400).json({ error: 'Vui lòng chọn cuốn sách cần mượn.' });
    }

    const newRequest = BorrowRequest.createRequest({
      user_id: req.user.id,
      book_id: Number(book_id)
    });

    res.status(201).json({
      message: 'Yêu cầu mượn sách đã được gửi và đang chờ Admin xác nhận.',
      request: newRequest
    });
  } catch (err) {
    console.error('Error creating borrow request:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi gửi yêu cầu mượn sách.' });
  }
});

// POST & PUT /api/borrow-requests/:id/approve - Admin approves request
const handleApprove = (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const result = BorrowRequest.approveRequest({
      request_id: requestId,
      admin_id: req.user.id
    });

    res.json({
      message: `Đã duyệt yêu cầu mượn sách thành công! Mã phiếu mượn: ${result.borrow_code}.`,
      data: result,
      result
    });
  } catch (err) {
    console.error('Error approving borrow request:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi duyệt yêu cầu mượn sách.' });
  }
};
router.post('/:id/approve', authMiddleware, authorize('admin'), handleApprove);
router.put('/:id/approve', authMiddleware, authorize('admin'), handleApprove);

// POST & PUT /api/borrow-requests/:id/reject - Admin rejects request with reason
const handleReject = (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const { rejection_reason } = req.body;

    if (!rejection_reason || !rejection_reason.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập lý do từ chối yêu cầu.' });
    }

    const updated = BorrowRequest.rejectRequest({
      request_id: requestId,
      admin_id: req.user.id,
      rejection_reason
    });

    res.json({
      message: 'Đã từ chối yêu cầu mượn sách.',
      request: updated
    });
  } catch (err) {
    console.error('Error rejecting borrow request:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi từ chối yêu cầu mượn sách.' });
  }
};
router.post('/:id/reject', authMiddleware, authorize('admin'), handleReject);
router.put('/:id/reject', authMiddleware, authorize('admin'), handleReject);

// POST & PUT /api/borrow-requests/:id/cancel - User cancels their own request
const handleCancel = (req, res) => {
  try {
    const requestId = parseInt(req.params.id, 10);
    const result = BorrowRequest.cancelRequest({
      request_id: requestId,
      user_id: req.user.id
    });

    res.json(result);
  } catch (err) {
    console.error('Error cancelling borrow request:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi hủy yêu cầu mượn sách.' });
  }
};
router.post('/:id/cancel', authMiddleware, handleCancel);
router.put('/:id/cancel', authMiddleware, handleCancel);

module.exports = router;
