import { useState, useEffect } from 'react';
import { reservationApi } from '../../api/reservationApi';
import { useToast } from '../../contexts/ToastContext';
import { Link } from 'react-router-dom';

export default function UserReservations() {
  const toast = useToast();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMyReservations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await reservationApi.getMyReservations();
      setReservations(res.data || []);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách đặt trước.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReservations();
  }, []);

  const handleCancel = async (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy đặt trước cuốn sách "${item.book_title}"?`)) {
      return;
    }
    try {
      const res = await reservationApi.cancelReservation(item.id);
      toast.success(res.message);
      fetchMyReservations();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hủy đặt trước.');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Sách Đặt Trước Của Bạn</h1>
          <p className="page-subtitle">Theo dõi vị trí hàng đợi và hạn giữ sách khi sách được hoàn trả về thư viện</p>
        </div>
        <div>
          <Link to="/user/search" className="btn btn-primary">
            🔍 Khám phá thêm sách
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '250px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách đặt trước...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={fetchMyReservations}>
            Thử lại
          </button>
        </div>
      ) : reservations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔖</div>
          <div className="empty-state-title">Bạn chưa có lượt đặt trước nào</div>
          <p className="empty-state-text">
            Khi cuốn sách bạn cần đã hết trong kho, hãy bấm "Đặt trước" trong mục tra cứu để được xếp hàng ưu tiên khi có sách!
          </p>
          <Link to="/user/search" className="btn btn-primary" style={{ marginTop: '12px' }}>
            Tra cứu kho sách ngay
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {reservations.map((r) => {
            const isReady = r.status === 'ready';
            const isPending = r.status === 'pending';
            return (
              <div
                key={r.id}
                style={{
                  background: 'var(--color-surface)',
                  border: isReady ? '2px solid var(--color-success)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-xs)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div
                    style={{
                      width: '54px',
                      height: '54px',
                      borderRadius: 'var(--radius-md)',
                      background: isReady ? 'var(--color-success-bg)' : 'var(--color-bg-warm)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '26px'
                    }}
                  >
                    {isReady ? '🎁' : '🔖'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', marginBottom: '4px' }}>{r.book_title}</h3>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      Mã sách: <strong>{r.book_code}</strong> • Vị trí kệ: {r.shelf_code || 'Kho lưu trữ'}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: '4px' }}>
                      Ngày đặt: {r.reservation_date ? new Date(r.reservation_date).toLocaleDateString('vi-VN') : '—'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    {isReady ? (
                      <div>
                        <span className="badge badge-success" style={{ fontSize: '13px', padding: '4px 12px' }}>
                          ✓ Sẵn sàng nhận tại thư viện
                        </span>
                        <div style={{ fontSize: '12px', color: 'var(--color-error)', fontWeight: 'bold', marginTop: '4px' }}>
                          Hạn đến lấy: {r.expiry_date}
                        </div>
                      </div>
                    ) : isPending ? (
                      <div>
                        <span className="badge badge-warning" style={{ fontSize: '13px', padding: '4px 12px' }}>
                          Đang trong hàng chờ (#Vị trí {r.queue_position})
                        </span>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          Hệ thống sẽ thông báo khi có sách về
                        </div>
                      </div>
                    ) : r.status === 'fulfilled' ? (
                      <span className="badge badge-info">Đã hoàn tất nhận sách</span>
                    ) : (
                      <span className="badge badge-neutral">Đã hủy</span>
                    )}
                  </div>

                  {(isReady || isPending) && (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCancel(r)}
                      title="Hủy giữ chỗ"
                    >
                      Hủy đặt
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
