import { useState, useEffect } from 'react';
import { dashboardApi } from '../../api/dashboardApi';

export default function Statistics() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getStatistics();
      setStats(res);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu thống kê.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0' }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>Đang tải dữ liệu thống kê thư viện...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
        <p>{error || 'Không thể tải thống kê.'}</p>
        <button className="btn btn-primary btn-sm" onClick={fetchStats} style={{ marginTop: '12px' }}>
          Tải lại
        </button>
      </div>
    );
  }

  const { topReaders, borrowStatusDist, shelfStats, financial } = stats;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Báo Cáo Thống Kê Thư Viện</h1>
          <p className="page-subtitle">Phân tích hiệu suất khai thác tài liệu, độc giả tích cực và tình hình tài chính</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchStats}>
          🔄 Làm mới dữ liệu
        </button>
      </div>

      {/* Financial & Circulation summary cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-card-label">Tổng thu tiền phạt</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success, #10b981)' }}>
            {formatVND(financial.total_collected)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Đã nộp vào quỹ thư viện
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Công nợ phạt chưa thu</span>
          <span className="stat-card-value" style={{ color: financial.total_debt > 0 ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)' }}>
            {formatVND(financial.total_debt)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--color-danger, #ef4444)' }}>
            Cần tiếp tục đôn đốc thu hồi
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Tổng lượt phiếu mượn</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {borrowStatusDist.reduce((acc, curr) => acc + curr.count, 0)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Tổng số giao dịch đã lập
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Tổng vị trí giá kệ sách</span>
          <span className="stat-card-value" style={{ color: '#8b5cf6' }}>
            {shelfStats.length}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {shelfStats.reduce((acc, curr) => acc + curr.copy_count, 0)} bản sách phân bổ
          </span>
        </div>
      </div>

      {/* Two-Column Section */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Top Active Readers */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>🏆 Top Độc Giả Mượn Sách Nhiều Nhất</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Mã ĐG / Họ tên</th>
                    <th>Liên hệ</th>
                    <th style={{ textAlign: 'center' }}>Đang mượn</th>
                    <th style={{ textAlign: 'right' }}>Tổng lượt mượn</th>
                  </tr>
                </thead>
                <tbody>
                  {topReaders.map((r, idx) => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: idx === 0 ? '#f59e0b' : idx === 1 ? '#94a3b8' : idx === 2 ? '#b45309' : 'var(--bg-secondary)',
                              color: idx < 3 ? '#fff' : 'var(--text-secondary)',
                              fontSize: '11px',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.reader_code}</span>
                            <div style={{ fontWeight: 500 }}>{r.full_name}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {r.phone || r.email}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{r.currently_borrowing}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)' }}>
                        {r.total_borrows} lượt
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Shelf allocation */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ margin: 0, fontSize: '16px' }}>📍 Phân Bổ Sách Theo Kệ & Vị Trí</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="table-responsive">
              <table className="table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Mã kệ</th>
                    <th>Tên kệ / Vị trí</th>
                    <th style={{ textAlign: 'right' }}>Đầu sách</th>
                    <th style={{ textAlign: 'right' }}>Số bản</th>
                  </tr>
                </thead>
                <tbody>
                  {shelfStats.map((s) => (
                    <tr key={s.code}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{s.code}</td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{s.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.location}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.title_count}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success, #10b981)' }}>
                        {s.copy_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
