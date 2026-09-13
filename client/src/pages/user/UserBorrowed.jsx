import { useState, useEffect } from 'react';
import { borrowApi } from '../../api/borrowApi';
import { borrowRequestApi } from '../../api/borrowRequestApi';
import { useToast } from '../../contexts/ToastContext';
import { formatDateTime, formatDate } from '../../utils/formatters';

export default function UserBorrowed() {
  const toast = useToast();
  const [activeRecords, setActiveRecords] = useState([]);
  const [borrowRequests, setBorrowRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);
  const [requestFilter, setRequestFilter] = useState('all'); // all, pending, rejected
  const [error, setError] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [borrowsRes, requestsRes] = await Promise.all([
        borrowApi.getMyActiveBorrows(),
        borrowRequestApi.getBorrowRequests({ limit: 50 })
      ]);
      setActiveRecords(borrowsRes.data || []);
      setBorrowRequests(requestsRes.data || []);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải dữ liệu mượn sách.');
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (recordId) => {
    try {
      const res = await borrowApi.renewBorrow(recordId);
      toast.success(res.message);
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gia hạn sách.');
    }
  };

  const handleCancelRequest = async (requestId, bookTitle) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy yêu cầu mượn cuốn sách "${bookTitle}"?`)) {
      return;
    }
    setCancellingId(requestId);
    try {
      const res = await borrowRequestApi.cancelBorrowRequest(requestId);
      toast.success(res.message || 'Đã hủy yêu cầu mượn sách.');
      fetchData();
    } catch (err) {
      toast.error(err.message || 'Không thể hủy yêu cầu mượn sách.');
    } finally {
      setCancellingId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const pendingRequests = borrowRequests.filter((r) => r.status === 'pending');
  const rejectedRequests = borrowRequests.filter((r) => r.status === 'rejected');
  const filteredRequests =
    requestFilter === 'pending'
      ? pendingRequests
      : requestFilter === 'rejected'
      ? rejectedRequests
      : borrowRequests.filter((r) => r.status === 'pending' || r.status === 'rejected');

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Sách Đang Mượn & Yêu Cầu</h1>
          <p className="page-subtitle">Theo dõi các yêu cầu mượn đang chờ duyệt và danh sách sách bạn đang mượn từ thư viện</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={fetchData} disabled={loading}>
          🔄 Làm mới
        </button>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '250px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải thông tin sách và yêu cầu...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={fetchData}>
            Thử lại
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Section 1: YÊU CẦU MƯỢN SÁCH */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>📬</span> Yêu Cầu Mượn Sách
                </h2>
                {pendingRequests.length > 0 && (
                  <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                    {pendingRequests.length} đang chờ duyệt
                  </span>
                )}
              </div>

              {borrowRequests.length > 0 && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    className={`btn btn-sm ${requestFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRequestFilter('all')}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Tất cả ({borrowRequests.filter((r) => r.status === 'pending' || r.status === 'rejected').length})
                  </button>
                  <button
                    className={`btn btn-sm ${requestFilter === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRequestFilter('pending')}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Chờ duyệt ({pendingRequests.length})
                  </button>
                  <button
                    className={`btn btn-sm ${requestFilter === 'rejected' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setRequestFilter('rejected')}
                    style={{ fontSize: '12px', padding: '4px 10px' }}
                  >
                    Từ chối ({rejectedRequests.length})
                  </button>
                </div>
              )}
            </div>

            {filteredRequests.length === 0 ? (
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px dashed var(--border-color)',
                borderRadius: '12px',
                padding: '24px',
                textAlign: 'center',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📭</span>
                {requestFilter === 'pending'
                  ? 'Hiện không có yêu cầu mượn nào đang chờ Admin duyệt.'
                  : 'Bạn hiện không có yêu cầu mượn sách nào trong danh sách này.'}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {filteredRequests.map((req) => {
                  const isPending = req.status === 'pending';
                  const isRejected = req.status === 'rejected';

                  return (
                    <div
                      key={req.id}
                      style={{
                        background: 'var(--color-surface)',
                        border: isPending
                          ? '1px solid rgba(245, 158, 11, 0.4)'
                          : isRejected
                          ? '1px solid rgba(239, 68, 68, 0.4)'
                          : '1px solid var(--border-color)',
                        borderRadius: '12px',
                        padding: '16px 20px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Top Accent Strip */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: '4px',
                          background: isPending ? '#f59e0b' : isRejected ? '#ef4444' : '#94a3b8'
                        }}
                      />

                      <div>
                        {/* Header: Code & Badge */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: 'var(--text-secondary)' }}>
                            {req.request_code}
                          </span>
                          {isPending && (
                            <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', fontWeight: '600' }}>
                              🟡 Chờ Admin xác nhận
                            </span>
                          )}
                          {isRejected && (
                            <span className="badge badge-danger" style={{ fontWeight: '600' }}>
                              🔴 Bị từ chối
                            </span>
                          )}
                        </div>

                        {/* Book details */}
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <div
                            style={{
                              width: '42px',
                              height: '56px',
                              borderRadius: '4px',
                              background: 'var(--bg-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '22px',
                              flexShrink: 0
                            }}
                          >
                            📖
                          </div>
                          <div>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.3 }}>
                              {req.book_title}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '3px' }}>
                              Mã: <strong>{req.book_code}</strong> {req.author_name ? `• Tác giả: ${req.author_name}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.5 }}>
                          <div>
                            <strong>Gửi lúc:</strong> {formatDateTime(req.requested_at)}
                          </div>
                          {req.processed_at && (
                            <div>
                              <strong>Phản hồi lúc:</strong> {formatDateTime(req.processed_at)}
                            </div>
                          )}
                        </div>

                        {/* Notice for Pending */}
                        {isPending && (
                          <div
                            style={{
                              fontSize: '11px',
                              background: 'rgba(245, 158, 11, 0.08)',
                              border: '1px solid rgba(245, 158, 11, 0.2)',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              color: '#92400e',
                              marginTop: '8px'
                            }}
                          >
                            ℹ Yêu cầu sẽ được Admin xác nhận trước khi sách được ghi nhận là đang mượn.
                          </div>
                        )}

                        {/* Rejection reason */}
                        {isRejected && req.rejection_reason && (
                          <div
                            style={{
                              fontSize: '12px',
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.25)',
                              borderRadius: '6px',
                              padding: '8px 12px',
                              color: '#b91c1c',
                              marginTop: '8px'
                            }}
                          >
                            <strong>Lý do từ chối:</strong> {req.rejection_reason}
                          </div>
                        )}
                      </div>

                      {/* Cancel Action if pending */}
                      {isPending && (
                        <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleCancelRequest(req.id, req.book_title)}
                            disabled={cancellingId === req.id}
                            style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--text-secondary)' }}
                          >
                            {cancellingId === req.id ? 'Đang hủy...' : 'Hủy yêu cầu'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: SÁCH ĐANG MƯỢN CHÍNH THỨC */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📚</span> Sách Đang Mượn
              </h2>
              <span className="badge badge-primary" style={{ fontWeight: '600' }}>
                {activeRecords.length} phiếu mượn
              </span>
            </div>

            {activeRecords.length === 0 ? (
              <div className="empty-state" style={{ padding: '36px 20px', background: 'var(--color-surface)', borderRadius: '12px' }}>
                <div className="empty-state-icon">📖</div>
                <div className="empty-state-title">Bạn hiện không mượn cuốn sách nào</div>
                <p className="empty-state-text">
                  Hãy khám phá kho sách của thư viện trong mục "Tra cứu sách" để gửi yêu cầu mượn tài liệu học tập bạn cần!
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
                          <span style={{ marginLeft: '14px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                            Thời điểm mượn: <strong>{formatDateTime(record.borrowed_at || record.borrow_date)}</strong>
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
                          Hạn hoàn trả: <strong style={{ color: isOverdue ? 'var(--color-error)' : 'inherit' }}>{formatDateTime(record.due_date)}</strong>
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
        </div>
      )}
    </div>
  );
}
