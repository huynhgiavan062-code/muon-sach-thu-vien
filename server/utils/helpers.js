const { dbGet } = require('../config/database');

function getSetting(key) {
  const row = dbGet('SELECT value FROM system_settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function getSettingInt(key, defaultValue = 0) {
  const val = getSetting(key);
  return val !== null ? parseInt(val, 10) : defaultValue;
}

function generateCode(prefix, id) {
  return `${prefix}-${String(id).padStart(3, '0')}`;
}

function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDateTime(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

module.exports = { getSetting, getSettingInt, generateCode, formatDate, formatDateTime, daysBetween };
