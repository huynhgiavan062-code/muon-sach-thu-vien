import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../api/dashboardApi';

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUserDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getUserDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải trang chủ độc giả.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDashboard();
  }, []);

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Đang tải thông tin trang chủ độc giả...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
        <p>{error || 'Không thể hiển thị dữ liệu.'}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchUserDashboard} style={{ marginTop: '12px' }}>
          Tải lại
        </button>
      </div>
    );
  }

  const { metrics, activeBorrows, reservations, notifications, newArrivals } = data;

  return (
    <div>
      {/* Welcome Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
          borderRadius: '14px',
          padding: '24px 28px',
          color: '#fff',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
            THƯ VIỆN TRUNG TÂM ĐẠI HỌC
          </span>
          <h1 style={{ margin: '6px 0 8px', fontSize: '24px', fontWeight: 700 }}>
            Xin chào, {user?.full_name}!
          </h1>
          <p style={{ margin: 0, fontSize: '13px', opacity: 0.9 }}>
            Mã thẻ thư viện: <strong>{user?.reader_code || '---'}</strong> • Email: {user?.email}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn"
            onClick={() => navigate('/user/search')}
            style={{ background: '#fff', color: '#1e3a8a', fontWeight: 600, border: 'none' }}
          >
            🔍 Tra cứu sách
          </button>
          <button
            className="btn"
            onClick={() => navigate('/user/profile')}
            style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.4)' }}
          >
            👤 Thẻ thư viện
          </button>
        </div>
      </div>

      {/* Pending Borrow Requests Banner */}
      {metrics.pending_requests_count > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(217, 119, 6, 0.05))',
          border: '1px solid rgba(245, 158, 11, 0.35)',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '24px' }}>📬</span>
            <div>
              <div style={{ fontWeight: '700', color: '#b45309', fontSize: '15px' }}>
                Bạn có {metrics.pending_requests_count} yêu cầu mượn sách đang chờ Admin xác nhận
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Yêu cầu sẽ được xử lý trước khi sách được ghi nhận là đang mượn chính thức.
              </div>
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => navigate('/user/borrowed')}
            style={{ borderColor: '#d97706', color: '#b45309', fontWeight: '600' }}
          >
            Xem chi tiết yêu cầu →
          </button>
        </div>
      )}

      {/* User Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" onClick={() => navigate('/user/borrowed')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Sách đang mượn</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {metrics.active_borrows_count}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Xem hạn trả & gia hạn
          </span>
        </div>

        <div className="stat-card" onClick={() => navigate('/user/reservations')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Đặt trước sách</span>
          <span className="stat-card-value" style={{ color: '#0284c7' }}>
            {metrics.reservations_count}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Yêu cầu đang giữ chỗ
          </span>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate('/user/fines')}
          style={{
            cursor: 'pointer',
            borderColor: metrics.unpaid_fines > 0 ? 'rgba(239, 68, 68, 0.3)' : undefined
          }}
        >
          <span className="stat-card-label">Tiền phạt chưa thanh toán</span>
          <span className="stat-card-value" style={{ color: metrics.unpaid_fines > 0 ? '#ef4444' : '#10b981' }}>
            {formatVND(metrics.unpaid_fines)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: metrics.unpaid_fines > 0 ? '#ef4444' : '#10b981' }}>
            {metrics.unpaid_fines_count > 0 ? `${metrics.unpaid_fines_count} khoản nợ` : 'Không có nợ phạt'}
          </span>
        </div>

        <div className="stat-card" onClick={() => navigate('/user/notifications')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Thông báo hệ thống</span>
          <span className="stat-card-value" style={{ color: '#8b5cf6' }}>
            {notifications.filter(n => !n.is_read).length}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Tin nhắn chưa đọc
          </span>
        </div>
      </div>

      {/* Two Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left: Active Borrows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>📖 Sách Bạn Đang Mượn</h3>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/user/borrowed')}>
                Xem tất cả ({activeBorrows.length}) →
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {activeBorrows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px' }}>
                  <span style={{ fontSize: '36px', display: 'block', marginBottom: '8px' }}>📚</span>
                  <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    Bạn hiện không mượn cuốn sách nào
                  </p>
                  <p style={{ margin: '4px 0 12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Hãy khám phá kho tài liệu phong phú của thư viện ngay hôm nay!
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => navigate('/user/search')}>
                    Tìm sách mượn ngay
                  </button>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Mã phiếu</th>
                        <th>Tên sách</th>
                        <th>Hạn trả</th>
                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBorrows.map((b) => (
                        <tr key={b.id}>
                          <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{b.borrow_code}</td>
                          <td style={{ maxWidth: '220px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {b.book_titles}
                          </td>
                          <td style={{ fontSize: '12px', color: b.status === 'overdue' ? 'var(--color-danger)' : undefined }}>
                            {b.due_date}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {b.status === 'overdue' ? (
                              <span className="badge badge-danger">Quá hạn</span>
                            ) : (
                              <span className="badge badge-primary">Đang mượn</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* New arrivals / Recommended */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>✨ Sách Mới Về Thư Viện</h3>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/user/search')}>
                Tra cứu thêm →
              </button>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                {newArrivals.map((bk) => (
                  <div
                    key={bk.id}
                    style={{
                      background: 'var(--bg-secondary)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: '1px solid var(--border-color)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                        {bk.category_name}
                      </span>
                      <h4 style={{ margin: '4px 0 6px', fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.3' }}>
                        {bk.title}
                      </h4>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {bk.author_name || 'Nhiều tác giả'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '11px', color: 'var(--color-success, #10b981)' }}>
                        Còn {bk.available_quantity} bản
                      </span>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => navigate('/user/search')}
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Notifications & Quick Access */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Notifications Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>🔔 Thông Báo Mới Nhất</h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate('/user/notifications')}
                style={{ fontSize: '11px' }}
              >
                Tất cả
              </button>
            </div>
            <div className="card-body" style={{ padding: '12px' }}>
              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Không có thông báo mới
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px',
                        borderRadius: '6px',
                        background: !n.is_read ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-secondary)',
                        borderLeft: !n.is_read ? '3px solid var(--color-primary)' : '3px solid transparent'
                      }}
                    >
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                        {new Date(n.created_at).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Reservations preview */}
          {reservations.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>🔖 Sách Đặt Trước Của Bạn</h3>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => navigate('/user/reservations')}
                  style={{ fontSize: '11px' }}
                >
                  Xem
                </button>
              </div>
              <div className="card-body" style={{ padding: '12px' }}>
                {reservations.map((r) => (
                  <div key={r.id} style={{ marginBottom: '8px', fontSize: '13px' }}>
                    <div style={{ fontWeight: 600 }}>{r.book_title}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      <span>Trạng thái: <strong>{r.status === 'ready' ? 'Đã có sẵn tại quầy' : `Hàng đợi #${r.queue_position}`}</strong></span>
                      {r.expiry_date && <span>Hạn lấy: {r.expiry_date}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
