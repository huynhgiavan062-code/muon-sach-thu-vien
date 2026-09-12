import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { notificationApi } from '../../api/notificationApi';
import './Topbar.css';

export default function Topbar({ title, onMenuToggle }) {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Notifications
  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationApi.getNotifications({ limit: 5 });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      // silently fail if network/auth not ready
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s poll
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotif(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleProfile = () => {
    setShowDropdown(false);
    navigate(isAdmin ? '/admin/accounts' : '/user/profile');
  };

  const handleMarkAsRead = async (notif) => {
    if (!notif.is_read) {
      try {
        await notificationApi.markAsRead(notif.id);
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (err) {
        console.error(err);
      }
    }
    if (notif.link) {
      setShowNotif(false);
      navigate(notif.link);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
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

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-menu-btn" onClick={onMenuToggle}>
          ☰
        </button>
        <h1 className="topbar-title">{title}</h1>
      </div>

      <div className="topbar-right">
        {/* Notification bell & dropdown */}
        <div className="topbar-notif-wrapper" ref={notifRef}>
          <button
            className="topbar-icon-btn"
            onClick={() => setShowNotif(!showNotif)}
            title="Thông báo"
          >
            🔔
            {unreadCount > 0 && (
              <span className="topbar-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <div className="topbar-notif-dropdown">
              <div className="topbar-notif-header">
                <span className="topbar-notif-title">Thông báo</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}
                  >
                    Đọc tất cả
                  </button>
                )}
              </div>

              <div className="topbar-notif-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Không có thông báo mới
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      className={`topbar-notif-item ${!n.is_read ? 'unread' : ''}`}
                      onClick={() => handleMarkAsRead(n)}
                    >
                      <span style={{ fontSize: '16px', flexShrink: 0 }}>{getNotifIcon(n.type)}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: !n.is_read ? 600 : 500, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginTop: '2px' }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                          {new Date(n.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {new Date(n.created_at).toLocaleDateString('vi-VN')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="topbar-notif-footer">
                <button
                  onClick={() => {
                    setShowNotif(false);
                    navigate(isAdmin ? '/admin' : '/user/notifications');
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 500 }}
                >
                  Xem toàn bộ thông báo →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User dropdown */}
        <div className="topbar-user" ref={dropdownRef}>
          <button
            className="topbar-user-btn"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="topbar-avatar">
              {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{user?.full_name}</span>
              <span className="topbar-user-role">
                {isAdmin ? 'Quản trị viên' : 'Độc giả'}
              </span>
            </div>
            <span className="topbar-chevron">▾</span>
          </button>

          {showDropdown && (
            <div className="topbar-dropdown">
              <div className="topbar-dropdown-header">
                <div className="topbar-dropdown-name">{user?.full_name}</div>
                <div className="topbar-dropdown-email">{user?.email}</div>
              </div>
              <div className="topbar-dropdown-divider" />
              <button className="topbar-dropdown-item" onClick={handleProfile}>
                <span>👤</span> Tài khoản
              </button>
              <div className="topbar-dropdown-divider" />
              <button className="topbar-dropdown-item topbar-dropdown-logout" onClick={handleLogout}>
                <span>↩</span> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
