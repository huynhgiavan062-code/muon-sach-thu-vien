const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

// GET /api/notifications - Get current user notifications
router.get('/', authMiddleware, (req, res) => {
  try {
    const { page = 1, limit = 20, is_read } = req.query;
    const result = Notification.findAll({
      user_id: req.user.id,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      is_read: is_read !== undefined ? is_read : ''
    });
    res.json(result);
  } catch (err) {
    console.error('Error getting notifications:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách thông báo.' });
  }
});

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', authMiddleware, (req, res) => {
  try {
    const count = Notification.getUnreadCount(req.user.id);
    res.json({ unreadCount: count });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(500).json({ error: 'Lỗi khi tải số thông báo chưa đọc.' });
  }
});

// PATCH /api/notifications/read-all - Mark all as read
router.patch('/read-all', authMiddleware, (req, res) => {
  try {
    Notification.markAllAsRead(req.user.id);
    res.json({ message: 'Đã đánh dấu tất cả thông báo là đã đọc.' });
  } catch (err) {
    console.error('Error marking all read:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái thông báo.' });
  }
});

// PATCH /api/notifications/:id/read - Mark single as read
router.patch('/:id/read', authMiddleware, (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    Notification.markAsRead(notifId, req.user.id);
    res.json({ message: 'Đã đánh dấu thông báo là đã đọc.' });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái thông báo.' });
  }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const notifId = parseInt(req.params.id, 10);
    Notification.delete(notifId, req.user.id);
    res.json({ message: 'Đã xóa thông báo.' });
  } catch (err) {
    console.error('Error deleting notification:', err);
    res.status(500).json({ error: 'Lỗi khi xóa thông báo.' });
  }
});

module.exports = router;
