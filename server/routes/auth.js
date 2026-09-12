const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware, generateToken } = require('../middleware/auth');

// POST /api/auth/register - Public user registration
router.post('/register', (req, res) => {
  try {
    const {
      full_name,
      email,
      username,
      password,
      confirm_password,
      phone
    } = req.body;

    // 1. Validate required fields
    if (!full_name || !full_name.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập họ và tên.' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập địa chỉ email.' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ error: 'Địa chỉ email không hợp lệ.' });
    }

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập.' });
    }

    // Username format validation (alphanumeric and underscores, 3-30 chars)
    const usernameTrimmed = username.trim();
    if (usernameTrimmed.length < 3) {
      return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(usernameTrimmed)) {
      return res.status(400).json({ error: 'Tên đăng nhập chỉ được chứa chữ cái, số, dấu gạch dưới, gạch ngang hoặc dấu chấm.' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 6 ký tự.' });
    }

    if (confirm_password !== undefined && password !== confirm_password) {
      return res.status(400).json({ error: 'Mật khẩu xác nhận không khớp.' });
    }

    // Phone validation if provided
    let phoneTrimmed = null;
    if (phone && phone.trim()) {
      phoneTrimmed = phone.trim();
      const phoneRegex = /^[0-9+]{9,15}$/;
      if (!phoneRegex.test(phoneTrimmed)) {
        return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });
      }
    }

    // 2. Check unique email
    const existingEmail = User.findByEmail(email.trim());
    if (existingEmail) {
      return res.status(400).json({ error: 'Email này đã được sử dụng.' });
    }

    // 3. Check unique username
    const existingUsername = User.findByUsername(usernameTrimmed);
    if (existingUsername) {
      return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại.' });
    }

    // 4. ROLE ENFORCEMENT: ALWAYS force role 'user' regardless of any request body property
    const role = 'user';

    // 5. Create user and assign auto-generated reader_code
    const result = User.create({
      username: usernameTrimmed,
      email: email.trim(),
      password,
      full_name: full_name.trim(),
      phone: phoneTrimmed,
      role
    });

    const newUser = User.findById(result.lastInsertRowid);

    // 6. Automatically send welcome notification
    try {
      const { dbRun } = require('../config/database');
      dbRun(`
        INSERT INTO notifications (user_id, title, message, type)
        VALUES (?, ?, ?, 'success')
      `, [
        newUser.id,
        'Chào mừng bạn đến với Thư viện Đại học!',
        `Tài khoản độc giả của bạn đã được kích hoạt với Mã thẻ: ${newUser.reader_code}. Chúc bạn có những trải nghiệm học tập và nghiên cứu bổ ích.`
      ]);
    } catch (notifErr) {
      console.warn('Welcome notification warning:', notifErr);
    }

    res.status(201).json({
      message: 'Đăng ký tài khoản thành công.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        full_name: newUser.full_name,
        reader_code: newUser.reader_code,
        role: newUser.role
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký. Vui lòng thử lại.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
    }

    const user = User.findByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    if (user.status === 'locked') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Tài khoản của bạn đã bị tạm ngưng. Vui lòng liên hệ quản trị viên.' });
    }

    const validPassword = User.verifyPassword(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
    }

    const token = generateToken(user);

    res.json({
      message: 'Đăng nhập thành công',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        reader_code: user.reader_code,
        avatar: user.avatar
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, (req, res) => {
  try {
    const user = User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng.' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const { full_name, phone, email, address, date_of_birth } = req.body;
    User.update(req.user.id, { full_name, phone, email, address, date_of_birth });
    const updated = User.findById(req.user.id);
    res.json({ message: 'Cập nhật thông tin thành công.', user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ thông tin.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    const user = User.findByUsername(req.user.username);
    if (!User.verifyPassword(currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    }

    User.updatePassword(req.user.id, newPassword);
    res.json({ message: 'Đổi mật khẩu thành công.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Lỗi hệ thống.' });
  }
});

module.exports = router;
