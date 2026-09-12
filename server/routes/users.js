const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/users/stats - Quick reader/user stats (Admin only)
router.get('/stats', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const stats = User.getStats();
    res.json({ stats });
  } catch (err) {
    console.error('Error getting user stats:', err);
    res.status(500).json({ error: 'Lỗi khi tải thống kê người dùng.' });
  }
});

// GET /api/users/next-reader-code - Preview auto-generated reader code (Admin only)
router.get('/next-reader-code', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const nextCode = User.generateNextReaderCode();
    res.json({ nextCode });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi tạo mã độc giả.' });
  }
});

// GET /api/users - List users/readers with search, filter, pagination (Admin only)
router.get('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      role = '',
      status = ''
    } = req.query;

    const result = User.findAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      role,
      status
    });

    res.json(result);
  } catch (err) {
    console.error('Error getting users:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách tài khoản/độc giả.' });
  }
});

// GET /api/users/:id/reader-profile - Full reader profile with borrow history & fines
router.get('/:id/reader-profile', authMiddleware, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    // Allow admin or self
    if (req.user.role !== 'admin' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem thông tin này.' });
    }

    const profile = User.getReaderDetails(targetId);
    if (!profile) {
      return res.status(404).json({ error: 'Không tìm thấy thông tin độc giả.' });
    }

    res.json(profile);
  } catch (err) {
    console.error('Error getting reader profile:', err);
    res.status(500).json({ error: 'Lỗi khi tải hồ sơ độc giả.' });
  }
});

// GET /api/users/:id - Get single user by ID
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (req.user.role !== 'admin' && req.user.id !== targetId) {
      return res.status(403).json({ error: 'Bạn không có quyền xem thông tin này.' });
    }

    const user = User.findById(targetId);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Error getting user:', err);
    res.status(500).json({ error: 'Lỗi khi tải thông tin người dùng.' });
  }
});

// POST /api/users - Create new user or reader (Admin only)
router.post('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const {
      username,
      email,
      password,
      full_name,
      phone,
      role = 'user',
      reader_code,
      address,
      date_of_birth
    } = req.body;

    // Validation
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập.' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập email.' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập họ và tên.' });
    }

    // Check duplicate username
    if (User.findByUsername(username.trim())) {
      return res.status(400).json({ error: `Tên đăng nhập "${username}" đã tồn tại.` });
    }

    // Check duplicate email
    if (User.findByEmail(email.trim())) {
      return res.status(400).json({ error: `Email "${email}" đã được đăng ký.` });
    }

    // Check duplicate reader_code if provided
    if (reader_code && reader_code.trim()) {
      if (User.findByReaderCode(reader_code.trim())) {
        return res.status(400).json({ error: `Mã độc giả "${reader_code}" đã tồn tại.` });
      }
    }

    const result = User.create({
      username: username.trim(),
      email: email.trim(),
      password,
      full_name: full_name.trim(),
      phone: phone ? phone.trim() : null,
      role,
      reader_code: reader_code ? reader_code.trim() : undefined,
      address: address ? address.trim() : null,
      date_of_birth: date_of_birth || null
    });

    const newUser = User.findById(result.lastInsertRowid);
    res.status(201).json({ message: 'Tạo tài khoản thành công.', user: newUser });
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: 'Lỗi khi tạo tài khoản người dùng.' });
  }
});

// PUT /api/users/:id - Update user info (Admin only)
router.put('/:id', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const existing = User.findById(targetId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng cần cập nhật.' });
    }

    const {
      full_name,
      email,
      phone,
      address,
      date_of_birth,
      reader_code,
      role,
      status
    } = req.body;

    if (full_name !== undefined && !full_name.trim()) {
      return res.status(400).json({ error: 'Họ tên không được để trống.' });
    }

    // Check email conflict if changing
    if (email && email.trim() !== existing.email) {
      const emailUser = User.findByEmail(email.trim());
      if (emailUser && emailUser.id !== targetId) {
        return res.status(400).json({ error: `Email "${email}" đã được sử dụng bởi tài khoản khác.` });
      }
    }

    // Check reader_code conflict if changing
    if (reader_code && reader_code.trim() !== existing.reader_code) {
      const rcUser = User.findByReaderCode(reader_code.trim());
      if (rcUser && rcUser.id !== targetId) {
        return res.status(400).json({ error: `Mã độc giả "${reader_code}" đã tồn tại.` });
      }
    }

    const updateFields = {};
    if (full_name !== undefined) updateFields.full_name = full_name.trim();
    if (email !== undefined) updateFields.email = email.trim();
    if (phone !== undefined) updateFields.phone = phone ? phone.trim() : null;
    if (address !== undefined) updateFields.address = address ? address.trim() : null;
    if (date_of_birth !== undefined) updateFields.date_of_birth = date_of_birth;
    if (reader_code !== undefined) updateFields.reader_code = reader_code ? reader_code.trim() : null;
    if (role !== undefined) updateFields.role = role;
    if (status !== undefined) updateFields.status = status;

    User.update(targetId, updateFields);
    const updated = User.findById(targetId);
    res.json({ message: 'Cập nhật thông tin thành công.', user: updated });
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật người dùng.' });
  }
});

// PATCH /api/users/:id/status - Change status (lock / unlock / suspend) (Admin only)
router.patch('/:id/status', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { status } = req.body;

    if (!['active', 'locked', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Trạng thái không hợp lệ (chỉ chấp nhận: active, locked, suspended).' });
    }

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Không thể tự khóa tài khoản của chính mình.' });
    }

    const existing = User.findById(targetId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    User.updateStatus(targetId, status);
    const statusText = status === 'active' ? 'kích hoạt' : status === 'locked' ? 'khóa' : 'tạm ngưng';
    res.json({ message: `Đã ${statusText} tài khoản thành công.`, status });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({ error: 'Lỗi khi cập nhật trạng thái tài khoản.' });
  }
});

// PATCH /api/users/:id/reset-password - Admin reset password for user
router.patch('/:id/reset-password', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const existing = User.findById(targetId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
    }

    User.updatePassword(targetId, newPassword);
    res.json({ message: `Đã đặt lại mật khẩu cho tài khoản "${existing.username}" thành công.` });
  } catch (err) {
    console.error('Error resetting password:', err);
    res.status(500).json({ error: 'Lỗi khi đặt lại mật khẩu.' });
  }
});

// DELETE /api/users/:id - Delete user (Admin only)
router.delete('/:id', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);

    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'Không thể xóa tài khoản của chính mình.' });
    }

    const existing = User.findById(targetId);
    if (!existing) {
      return res.status(404).json({ error: 'Không tìm thấy tài khoản cần xóa.' });
    }

    User.delete(targetId);
    res.json({ message: `Đã xóa tài khoản "${existing.full_name}" thành công.` });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi xóa tài khoản.' });
  }
});

module.exports = router;
