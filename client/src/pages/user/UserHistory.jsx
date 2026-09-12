import { useState, useEffect, useCallback } from 'react';
import { borrowApi } from '../../api/borrowApi';

export default function UserHistory() {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await borrowApi.getMyBorrowHistory({ page, limit: 10 });
      setHistory(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Lỗi khi tải lịch sử mượn trả.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory(1);
  }, [fetchHistory]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lịch Sử Mượn Sách</h1>
        <p className="page-subtitle">Nhật ký các đầu sách bạn đã từng mượn và hoàn trả cho thư viện</p>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '250px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải lịch sử mượn sách...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchHistory(pagination.page)}>
            Thử lại
          </button>
        </div>
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Chưa có lịch sử mượn sách</div>
          <p className="empty-state-text">
            Bạn chưa có lượt mượn sách nào đã hoàn tất.
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Danh sách sách đã mượn</th>
                  <th>Ngày mượn</th>
                  <th>Hạn trả</th>
                  <th>Ngày trả thực tế</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {record.borrow_code}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {record.items?.map((item) => (
                          <div key={item.detail_id} style={{ fontSize: 'var(--font-size-sm)' }}>
                            📖 <strong>{item.title}</strong> ({item.book_code})
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>{record.borrow_date}</td>
                    <td>{record.due_date}</td>
                    <td>
                      <strong>{record.return_date || '—'}</strong>
                    </td>
                    <td>
                      <span className="badge badge-success">Đã hoàn tất</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Hiển thị <strong>{history.length}</strong> / <strong>{pagination.total}</strong> lượt mượn
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchHistory(pagination.page - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                    onClick={() => fetchHistory(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchHistory(pagination.page + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
