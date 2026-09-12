const express = require('express');
const router = express.Router();
const { dbAll, dbRun } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/settings - Get all system settings
router.get('/', (req, res) => {
  try {
    const list = dbAll('SELECT key, value, description FROM system_settings');
    const settingsMap = {};
    list.forEach(item => {
      settingsMap[item.key] = item.value;
    });

    res.json({
      settings: settingsMap,
      list
    });
  } catch (err) {
    console.error('Error getting settings:', err);
    res.status(500).json({ error: 'Lỗi khi tải cấu hình hệ thống.' });
  }
});

// PUT /api/settings - Update system settings (Admin only)
router.put('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({ error: 'Dữ liệu cấu hình không hợp lệ.' });
    }

    for (const [key, value] of Object.entries(updates)) {
      dbRun(`
        INSERT INTO system_settings (key, value)
        VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `, [key, String(value)]);
    }

    const list = dbAll('SELECT key, value, description FROM system_settings');
    const settingsMap = {};
    list.forEach(item => {
      settingsMap[item.key] = item.value;
    });

    res.json({
      message: 'Cập nhật cấu hình hệ thống thành công.',
      settings: settingsMap,
      list
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ error: 'Lỗi khi lưu cấu hình hệ thống.' });
  }
});

module.exports = router;
