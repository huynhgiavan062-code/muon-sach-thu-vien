import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../api/dashboardApi';

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getAdminDashboard();
      setData(res);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu tổng quan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'returned':
        return <span className="badge badge-success">Đã trả</span>;
      case 'overdue':
        return <span className="badge badge-danger">Quá hạn</span>;
      case 'borrowing':
      default:
        return <span className="badge badge-primary">Đang mượn</span>;
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Đang tải bảng điều khiển tổng quan...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
        <p>{error || 'Không thể hiển thị dữ liệu.'}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchDashboardData} style={{ marginTop: '12px' }}>
          Tải lại
        </button>
      </div>
    );
  }

  const { metrics, recentBorrows, topBooks, categoryStats } = data;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Bảng Điều Khiển Tổng Quan</h1>
          <p className="page-subtitle">
            Xin chào, <strong>{user?.full_name}</strong>. Cập nhật số liệu lưu thông thư viện hôm nay.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={fetchDashboardData}>
            🔄 Làm mới
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/admin/borrow')}>
            ↔ Quầy Mượn - Trả
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card" onClick={() => navigate('/admin/books')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Tổng đầu sách</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {metrics.total_books}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {metrics.available_copies}/{metrics.total_copies} bản có sẵn trong kho
          </span>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/readers')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Độc giả sinh viên</span>
          <span className="stat-card-value" style={{ color: '#0284c7' }}>
            {metrics.total_readers}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Tài khoản độc giả hoạt động
          </span>
        </div>

        <div className="stat-card" onClick={() => navigate('/admin/borrow-records')} style={{ cursor: 'pointer' }}>
          <span className="stat-card-label">Đang lưu thông mượn</span>
          <span className="stat-card-value" style={{ color: '#10b981' }}>
            {metrics.active_borrows}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {metrics.borrowed_copies} cuốn sách đang ngoài thư viện
          </span>
        </div>

        <div
          className="stat-card"
          onClick={() => navigate('/admin/borrow-records')}
          style={{
            cursor: 'pointer',
            borderColor: metrics.overdue_borrows > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined,
            background: metrics.overdue_borrows > 0 ? 'rgba(239, 68, 68, 0.02)' : undefined
          }}
        >
          <span className="stat-card-label">Phiếu quá hạn</span>
          <span className="stat-card-value" style={{ color: metrics.overdue_borrows > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
            {metrics.overdue_borrows}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: '#ef4444' }}>
            Cần thu hồi & xử phạt
          </span>
        </div>
      </div>

      {/* Secondary Quick Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Nợ phạt chưa thu</span>
            <strong style={{ fontSize: '16px', color: metrics.unpaid_fines_amount > 0 ? '#ef4444' : '#10b981' }}>
              {formatVND(metrics.unpaid_fines_amount)}
            </strong>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/fines')} style={{ fontSize: '11px', padding: '4px 8px' }}>
            Quản lý phạt
          </button>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Đặt trước chờ duyệt</span>
            <strong style={{ fontSize: '16px', color: 'var(--color-primary)' }}>
              {metrics.pending_reservations} đang chờ • {metrics.ready_reservations} sẵn sàng
            </strong>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/reservations')} style={{ fontSize: '11px', padding: '4px 8px' }}>
            Xem danh sách
          </button>
        </div>

        <div style={{ background: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Tiền phạt đã thu lũy kế</span>
            <strong style={{ fontSize: '16px', color: '#10b981' }}>
              {formatVND(metrics.collected_fines_amount)}
            </strong>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/admin/reports?type=fines_debt')} style={{ fontSize: '11px', padding: '4px 8px' }}>
            Báo cáo
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Column: Recent Borrows & Category Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Recent Borrows */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>Phiếu Mượn Sách Gần Đây</h3>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => navigate('/admin/borrow-records')}
                style={{ fontSize: '12px' }}
              >
                Xem tất cả →
              </button>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {recentBorrows.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Chưa có phiếu mượn nào được tạo
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Mã phiếu</th>
                        <th>Độc giả</th>
                        <th>Ấn phẩm mượn</th>
                        <th>Hạn trả</th>
                        <th style={{ textAlign: 'center' }}>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBorrows.map((b) => (
                        <tr key={b.id}>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{b.borrow_code}</span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 500 }}>{b.reader_name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{b.reader_code}</div>
                          </td>
                          <td style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.book_titles}>
                            {b.book_titles || '---'}
                          </td>
                          <td style={{ fontSize: '12px' }}>
                            {b.due_date}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {getStatusBadge(b.status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Categories Distribution */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>Phân Bổ Kho Sách Theo Danh Mục</h3>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {categoryStats.map((c) => {
                  const maxCopies = Math.max(...categoryStats.map(item => item.total_copies), 1);
                  const percent = Math.min(100, Math.round((c.total_copies / maxCopies) * 100));
                  return (
                    <div key={c.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500 }}>{c.name}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          <strong>{c.book_count}</strong> tựa ({c.total_copies} bản)
                        </span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'var(--bg-secondary)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            background: 'linear-gradient(90deg, var(--color-primary), #60a5fa)',
                            borderRadius: '4px'
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Borrowed Books & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Actions Card */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-secondary) 0%, rgba(59, 130, 246, 0.05) 100%)' }}>
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>⚡ Thao Tác Nhanh Nghiệp Vụ</h3>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={() => navigate('/admin/borrow')}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              >
                <span>↔</span> Cho mượn / Trả sách tại quầy
              </button>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/books')}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              >
                <span>📖</span> Thêm tài liệu mới vào kho
              </button>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/imports')}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              >
                <span>📥</span> Lập phiếu nhập sách mới
              </button>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/fines')}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              >
                <span>💰</span> Thu tiền phạt độc giả
              </button>
              <button
                className="btn btn-outline"
                onClick={() => navigate('/admin/reports')}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '10px 14px' }}
              >
                <span>📄</span> Xuất báo cáo lưu thông
              </button>
            </div>
          </div>

          {/* Top Borrowed Books */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>🔥 Top Sách Mượn Nhiều Nhất</h3>
            </div>
            <div className="card-body" style={{ padding: '12px' }}>
              {topBooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  Chưa có dữ liệu mượn
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {topBooks.map((b, idx) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '8px',
                        borderRadius: '6px',
                        background: 'var(--bg-secondary)'
                      }}
                    >
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--border-color)',
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '12px',
                          flexShrink: 0
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {b.author_name || 'Nhiều tác giả'} • {b.category_name}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>
                          {b.borrow_count} lượt
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
