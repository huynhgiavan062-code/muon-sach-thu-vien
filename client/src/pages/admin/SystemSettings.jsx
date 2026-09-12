import { useState, useEffect } from 'react';
import { settingApi } from '../../api/settingApi';
import { useToast } from '../../contexts/ToastContext';

export default function SystemSettings() {
  const toast = useToast();

  const [settings, setSettings] = useState({
    max_borrow_books: '5',
    borrow_duration_days: '14',
    fine_per_day: '5000',
    max_renewals: '2',
    renewal_days: '7',
    reservation_expiry_days: '3'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await settingApi.getSettings();
      if (res.settings) {
        setSettings(prev => ({ ...prev, ...res.settings }));
      }
    } catch (err) {
      toast.error('Lỗi khi tải cấu hình hệ thống.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await settingApi.updateSettings(settings);
      toast.success(res.message || 'Cập nhật cấu hình hệ thống thành công!');
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Đang tải cấu hình hệ thống...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Cài Đặt & Tham Số Hệ Thống</h1>
        <p className="page-subtitle">Thiết lập các quy tắc mượn trả, hạn mức, mức phạt quá hạn và điều kiện đặt trước</p>
      </div>

      <div className="card" style={{ maxWidth: '800px' }}>
        <div className="card-header">
          <h2 className="card-title" style={{ margin: 0 }}>Quy Định Lưu Thông Thư Viện</h2>
        </div>

        <form onSubmit={handleSave}>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Số sách tối đa được mượn cùng lúc (cuốn)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="20"
                  value={settings.max_borrow_books}
                  onChange={(e) => handleChange('max_borrow_books', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Giới hạn số sách đang mượn trên một thẻ độc giả.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Thời hạn mượn sách mặc định (ngày)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="180"
                  value={settings.borrow_duration_days}
                  onChange={(e) => handleChange('borrow_duration_days', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Số ngày từ ngày mượn đến hạn trả sách.
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Mức phạt quá hạn mỗi ngày (VNĐ / cuốn / ngày)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1000"
                  step="1000"
                  value={settings.fine_per_day}
                  onChange={(e) => handleChange('fine_per_day', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Hệ thống tự tính phạt: (Số ngày trễ) × (Mức phạt).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Số ngày giữ sách đặt trước (ngày)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="14"
                  value={settings.reservation_expiry_days}
                  onChange={(e) => handleChange('reservation_expiry_days', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Thời hạn để bạn đọc đến quầy nhận sách đặt trước đã có sẵn.
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Số lần gia hạn tối đa (lần)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="0"
                  max="5"
                  value={settings.max_renewals}
                  onChange={(e) => handleChange('max_renewals', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Số lần độc giả được phép tự gia hạn trực tuyến.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Số ngày cộng thêm mỗi lần gia hạn (ngày)
                </label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  max="30"
                  value={settings.renewal_days}
                  onChange={(e) => handleChange('renewal_days', e.target.value)}
                  required
                />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                  Số ngày được cộng thêm vào hạn trả khi gia hạn thành công.
                </span>
              </div>
            </div>
          </div>

          <div className="card-footer" style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-outline" onClick={fetchSettings} disabled={saving}>
              Khôi phục lại
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : '💾 Lưu cài đặt hệ thống'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
