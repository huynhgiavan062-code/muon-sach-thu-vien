import { useState, useEffect } from 'react';
import { borrowApi } from '../../api/borrowApi';
import { useToast } from '../../contexts/ToastContext';

export default function UserBorrowed() {
  const toast = useToast();
  const [activeRecords, setActiveRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchActiveBorrows = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await borrowApi.getMyActiveBorrows();
      setActiveRecords(res.data || []);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách sách đang mượn.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (recordId) => {
    try {
      const res = await borrowApi.renewBorrow(recordId);
      toast.success(res.message);
      fetchActiveBorrows();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gia hạn sách.');
    }
  };

  useEffect(() => {
    fetchActiveBorrows();
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sách Đang Mượn</h1>
        <p className="page-subtitle">Danh sách các đầu sách bạn đang mượn từ thư viện và thời hạn hoàn trả</p>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '250px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách sách đang mượn...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={fetchActiveBorrows}>
            Thử lại
          </button>
        </div>
      ) : activeRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📖</div>
          <div className="empty-state-title">Bạn hiện không mượn cuốn sách nào</div>
          <p className="empty-state-text">
            Hãy khám phá kho sách của thư viện trong mục "Tra cứu sách" để tìm những tài liệu học tập hữu ích!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeRecords.map((record) => {
            const isOverdue = record.status === 'overdue';
            const today = new Date();
            const dueDate = new Date(record.due_date);
            const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
            const renewalCount = record.renewal_count || 0;
            const canRenew = !isOverdue && renewalCount < 2;

            return (
              <div
                key={record.id}
                style={{
                  background: 'var(--color-surface)',
                  border: isOverdue ? '1px solid var(--color-error)' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '20px',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Mã phiếu: </span>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{record.borrow_code}</strong>
                    <span style={{ marginLeft: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      Ngày mượn: {record.borrow_date}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="badge badge-neutral">Gia hạn: {renewalCount}/2 lần</span>
                    {isOverdue ? (
                      <span className="badge badge-error">Quá hạn ({Math.abs(diffDays)} ngày)</span>
                    ) : diffDays <= 3 ? (
                      <span className="badge badge-warning">Sắp đến hạn (Còn {diffDays} ngày)</span>
                    ) : (
                      <span className="badge badge-info">Còn {diffDays} ngày</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
                  {record.items?.map((item) => (
                    <div
                      key={item.detail_id}
                      style={{
                        padding: '12px',
                        background: 'var(--color-bg-warm)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}
                    >
                      <div style={{ fontSize: '28px' }}>📖</div>
                      <div>
                        <div style={{ fontWeight: '600', fontSize: 'var(--font-size-base)' }}>
                          {item.title}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                          Mã sách: <strong>{item.book_code}</strong> • Vị trí kệ: {item.shelf_code || 'Kho'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--color-border-light)', paddingTop: '12px', fontSize: 'var(--font-size-sm)', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    Hạn hoàn trả: <strong style={{ color: isOverdue ? 'var(--color-error)' : 'inherit' }}>{record.due_date}</strong>
                  </div>
                  <div>
                    {canRenew ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRenew(record.id)}
                        title="Gia hạn thêm 7 ngày"
                      >
                        ⚡ Gia hạn thêm 7 ngày
                      </button>
                    ) : (
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: '12px' }}>
                        {isOverdue ? 'Không thể gia hạn khi đã quá hạn' : 'Đã đạt tối đa 2 lần gia hạn'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
