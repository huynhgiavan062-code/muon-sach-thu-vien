const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/reservations/stats - Reservation statistics (Admin only)
router.get('/stats', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const stats = Reservation.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting reservation stats:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê đặt trước.' });
  }
});

// GET /api/reservations/my - Current user's reservations
router.get('/my', authMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 20, status = '' } = req.query;
    const result = Reservation.findAll({
      user_id: req.user.id,
      status,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
    res.json(result);
  } catch (err) {
    console.error('Error getting my reservations:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách đặt trước.' });
  }
});

// GET /api/reservations - All reservations (Admin only)
router.get('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      user_id = '',
      book_id = ''
    } = req.query;

    const result = Reservation.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      status,
      user_id,
      book_id
    });

    res.json(result);
  } catch (err) {
    console.error('Error getting reservations:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách đặt trước.' });
  }
});

// GET /api/reservations/:id - Single reservation detail
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const resId = parseInt(req.params.id, 10);
    const reservation = Reservation.findById(resId);
    if (!reservation) {
      return res.status(404).json({ error: 'Không tìm thấy lượt đặt trước.' });
    }

    if (req.user.role !== 'admin' && req.user.id !== reservation.user_id) {
      return res.status(403).json({ error: 'Bạn không có quyền xem thông tin này.' });
    }

    res.json({ reservation });
  } catch (err) {
    console.error('Error getting reservation:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin đặt trước.' });
  }
});

// POST /api/reservations - Create reservation
router.post('/', authMiddleware, (req, res) => {
  try {
    const { book_id, user_id, notes } = req.body;
    // If admin provides user_id, use it; otherwise use logged-in user id
    const targetUserId = (req.user.role === 'admin' && user_id) ? Number(user_id) : req.user.id;

    const result = Reservation.createReservation({
      user_id: targetUserId,
      book_id: Number(book_id),
      notes
    });

    const full = Reservation.findById(result.id);
    res.status(201).json({
      message: result.status === 'ready'
        ? `Đặt trước thành công! Sách "${result.book_title}" đang có sẵn tại thư viện. Hạn giữ sách: ${result.expiry_date}.`
        : `Đã vào hàng chờ đặt trước sách "${result.book_title}" (Vị trí #${result.queue_position}).`,
      reservation: full
    });
  } catch (err) {
    console.error('Error creating reservation:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi đặt trước sách.' });
  }
});

// DELETE /api/reservations/:id - Cancel reservation
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const resId = parseInt(req.params.id, 10);
    const isAdmin = req.user.role === 'admin';

    const result = Reservation.cancelReservation(resId, req.user.id, isAdmin);
    res.json(result);
  } catch (err) {
    console.error('Error cancelling reservation:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi hủy đặt trước.' });
  }
});

// POST /api/reservations/:id/fulfill - Fulfill reservation (Admin only)
router.post('/:id/fulfill', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const resId = parseInt(req.params.id, 10);
    const result = Reservation.fulfillReservation(resId);
    res.json(result);
  } catch (err) {
    console.error('Error fulfilling reservation:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi hoàn tất nhận sách.' });
  }
});

module.exports = router;
