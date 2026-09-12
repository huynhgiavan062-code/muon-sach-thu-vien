import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi } from '../../api/notificationApi';
import { useToast } from '../../contexts/ToastContext';

export default function UserNotifications() {
  const navigate = useNavigate();
  const toast = useToast();

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readFilter, setReadFilter] = useState(''); // '' | '0' | '1'

  const fetchNotifications = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await notificationApi.getNotifications({
        page,
        limit: 15,
        is_read: readFilter
      });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải thông báo.');
    } finally {
      setLoading(false);
    }
  }, [readFilter]);

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleMarkAsRead = async (notif) => {
    try {
      await notificationApi.markAsRead(notif.id);
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      if (notif.link) {
        navigate(notif.link);
      }
    } catch (err) {
      toast.error('Lỗi khi đánh dấu thông báo.');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      toast.success('Đã đánh dấu tất cả thông báo là đã đọc.');
      fetchNotifications(pagination.page);
    } catch (err) {
      toast.error('Lỗi khi cập nhật thông báo.');
    }
  };

  const handleDelete = async (e, notifId) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(notifId);
      toast.success('Đã xóa thông báo.');
      setNotifications(prev => prev.filter(n => n.id !== notifId));
    } catch (err) {
      toast.error('Lỗi khi xóa thông báo.');
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'warning': return '⚠️';
      case 'success': return '✓';
      case 'error': return '✕';
      default: return 'ℹ️';
    }
  };

  const getNotifColor = (type) => {
    switch (type) {
      case 'warning': return 'var(--color-warning, #f59e0b)';
      case 'success': return 'var(--color-success, #10b981)';
      case 'error': return 'var(--color-danger, #ef4444)';
      default: return 'var(--color-primary, #3b82f6)';
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Thông Báo Của Tôi</h1>
          <p className="page-subtitle">Nhắc nhở hạn trả sách, thông báo đặt trước có sẵn và các tin tức từ thư viện</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="btn btn-outline"
            onClick={handleMarkAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span>✓✓</span> Đánh dấu tất cả đã đọc ({unreadCount})
          </button>
        )}
      </div>

      <div className="card">
        {/* Tabs */}
        <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '24px' }}>
          <button
            onClick={() => setReadFilter('')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: readFilter === '' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: readFilter === '' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: readFilter === '' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Tất cả
          </button>
          <button
            onClick={() => setReadFilter('0')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: readFilter === '0' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: readFilter === '0' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: readFilter === '0' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Chưa đọc {unreadCount > 0 && `(${unreadCount})`}
          </button>
          <button
            onClick={() => setReadFilter('1')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: readFilter === '1' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: readFilter === '1' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: readFilter === '1' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Đã đọc
          </button>
        </div>

        {/* Notification Items */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner spinner-lg"></div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang tải danh sách thông báo...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={() => fetchNotifications(1)} style={{ marginTop: '8px' }}>
                Thử lại
              </button>
            </div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🔔</div>
              <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Không có thông báo nào
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Hộp thông báo của bạn đang trống.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border-color)',
                    background: !n.is_read ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'var(--bg-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      flexShrink: 0,
                      border: `1px solid ${getNotifColor(n.type)}`
                    }}
                  >
                    {getNotifIcon(n.type)}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: !n.is_read ? 700 : 500, color: 'var(--text-primary)' }}>
                        {n.title}
                      </h4>
                      {!n.is_read && (
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }}></span>
                      )}
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                      {n.message}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '8px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
                      <span>🕒 {new Date(n.created_at).toLocaleString('vi-VN')}</span>
                      {n.link && (
                        <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>
                          Xem chi tiết liên quan →
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={(e) => handleDelete(e, n.id)}
                      title="Xóa thông báo"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Trang {pagination.page} / {pagination.totalPages}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchNotifications(pagination.page - 1)}
              >
                Trước
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchNotifications(pagination.page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
