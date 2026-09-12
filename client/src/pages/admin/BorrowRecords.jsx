import { useState, useEffect, useCallback } from 'react';
import { borrowApi } from '../../api/borrowApi';
import { useToast } from '../../contexts/ToastContext';

export default function BorrowRecords() {
  const toast = useToast();

  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({ borrowingCount: 0, overdueCount: 0, returnedCount: 0, totalCount: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnNotes, setReturnNotes] = useState('');
  const [returning, setReturning] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await borrowApi.getBorrowStats();
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecords = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await borrowApi.getBorrowRecords({
        page,
        limit: 10,
        search,
        status: statusFilter
      });
      setRecords(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách phiếu mượn.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRecords(1);
  }, [fetchRecords]);

  // Open detail
  const handleOpenDetail = async (rec) => {
    try {
      const full = await borrowApi.getBorrowRecordById(rec.id);
      setSelectedRecord(full.record);
      setShowDetailModal(true);
    } catch (err) {
      toast.error('Lỗi khi tải chi tiết phiếu mượn.');
    }
  };

  // Open quick return
  const handleOpenReturn = (rec) => {
    setSelectedRecord(rec);
    setReturnNotes('');
    setShowReturnModal(true);
  };

  // Quick renew
  const handleRenew = async (recordId) => {
    try {
      const res = await borrowApi.renewBorrow(recordId);
      toast.success(res.message);
      fetchRecords(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gia hạn.');
    }
  };

  // Submit quick return
  const handleConfirmReturn = async () => {
    setReturning(true);
    try {
      const res = await borrowApi.returnBorrow(selectedRecord.id, {
        condition_notes: returnNotes
      });
      toast.success(res.message);
      setShowReturnModal(false);
      fetchRecords(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi trả sách.');
    } finally {
      setReturning(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản lý Phiếu Mượn Sách</h1>
        <p className="page-subtitle">Theo dõi lịch sử lưu thông, hạn trả sách và kiểm soát quá hạn của độc giả</p>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-card-label">Đang mượn</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {stats.borrowingCount}
          </span>
          <span className="stat-card-hint">Phiếu đang trong hạn</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Quá hạn</span>
          <span className="stat-card-value" style={{ color: 'var(--color-error)' }}>
            {stats.overdueCount}
          </span>
          <span className="stat-card-hint">Cần nhắc nhở / thu hồi</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Đã hoàn tất trả</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {stats.returnedCount}
          </span>
          <span className="stat-card-hint">Sách đã về kho</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Tổng lượt mượn</span>
          <span className="stat-card-value">{stats.totalCount}</span>
          <span className="stat-card-hint">Toàn thời gian</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tìm kiếm phiếu</label>
            <input
              type="text"
              className="form-input"
              placeholder="Mã phiếu, tên độc giả, tên sách..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Trạng thái phiếu</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="borrowing">Đang mượn</option>
              <option value="overdue">Quá hạn</option>
              <option value="returned">Đã hoàn tất trả</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="loading-page" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách phiếu mượn...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchRecords(pagination.page)}>
            Thử lại
          </button>
        </div>
      ) : records.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Không tìm thấy phiếu mượn nào</div>
          <p className="empty-state-text">
            {search || statusFilter ? 'Không có phiếu mượn khớp với bộ lọc tìm kiếm.' : 'Chưa có phiếu mượn nào được ghi nhận.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã phiếu</th>
                  <th>Độc giả</th>
                  <th>Số sách</th>
                  <th>Ngày mượn</th>
                  <th>Hạn trả</th>
                  <th>Ngày trả thực tế</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const isBorrowing = r.status === 'borrowing';
                  const isOverdue = r.status === 'overdue';
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                          {r.borrow_code}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{r.user_full_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {r.user_reader_code}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {r.total_books_count || r.items?.length || 1} cuốn
                        </span>
                      </td>
                      <td>{r.borrow_date}</td>
                      <td>
                        <strong style={{ color: isOverdue ? 'var(--color-error)' : 'inherit' }}>
                          {r.due_date}
                        </strong>
                      </td>
                      <td>{r.return_date || '—'}</td>
                      <td>
                        {isOverdue ? (
                          <span className="badge badge-error">Quá hạn</span>
                        ) : isBorrowing ? (
                          <span className="badge badge-info">Đang mượn</span>
                        ) : (
                          <span className="badge badge-success">Đã trả</span>
                        )}
                      </td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Xem chi tiết phiếu"
                            onClick={() => handleOpenDetail(r)}
                          >
                            👁
                          </button>
                          {isBorrowing && (r.renewal_count || 0) < 2 && (
                            <button
                              className="btn btn-secondary btn-sm"
                              title="Gia hạn thêm 7 ngày"
                              onClick={() => handleRenew(r.id)}
                            >
                              ⚡ Hạn
                            </button>
                          )}
                          {(isBorrowing || isOverdue) && (
                            <button
                              className="btn btn-primary btn-sm"
                              title="Nhận trả sách"
                              onClick={() => handleOpenReturn(r)}
                            >
                              ↩ Trả
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="pagination">
            <div className="pagination-info">
              Hiển thị <strong>{records.length}</strong> / <strong>{pagination.total}</strong> phiếu mượn
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchRecords(pagination.page - 1)}
              >
                ‹
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                  onClick={() => fetchRecords(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchRecords(pagination.page + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== MODAL: DETAIL ==================== */}
      {showDetailModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết phiếu mượn: {selectedRecord.borrow_code}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--color-bg-warm)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                <div><strong>Độc giả:</strong> {selectedRecord.user_full_name}</div>
                <div><strong>Mã độc giả:</strong> {selectedRecord.user_reader_code}</div>
                <div><strong>Ngày mượn:</strong> {selectedRecord.borrow_date}</div>
                <div><strong>Hạn trả:</strong> {selectedRecord.due_date}</div>
                <div><strong>Ngày trả:</strong> {selectedRecord.return_date || 'Chưa hoàn tất'}</div>
                <div>
                  <strong>Trạng thái: </strong>
                  {selectedRecord.status === 'overdue' ? (
                    <span className="badge badge-error">Quá hạn</span>
                  ) : selectedRecord.status === 'borrowing' ? (
                    <span className="badge badge-info">Đang mượn</span>
                  ) : (
                    <span className="badge badge-success">Đã trả</span>
                  )}
                </div>
              </div>

              <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Danh sách sách đã mượn:</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {selectedRecord.items?.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '10px 14px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border-light)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                        Mã: {item.book_code} • Kệ: {item.shelf_code || '—'}
                      </div>
                    </div>
                    <span className="badge badge-neutral">1 cuốn</span>
                  </div>
                ))}
              </div>

              {selectedRecord.fines?.length > 0 && (
                <div style={{ padding: '12px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                  <strong>Tiền phạt phát sinh:</strong> {selectedRecord.fines[0].amount?.toLocaleString('vi-VN')} đ ({selectedRecord.fines[0].reason})
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: QUICK RETURN ==================== */}
      {showReturnModal && selectedRecord && (
        <div className="modal-overlay" onClick={() => !returning && setShowReturnModal(false)}>
          <div className="modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận nhận trả sách</h3>
              <button className="modal-close" onClick={() => !returning && setShowReturnModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: '12px' }}>
                Thu hồi các cuốn sách trong phiếu <strong>{selectedRecord.borrow_code}</strong> của độc giả <strong>{selectedRecord.user_full_name}</strong>:
              </p>

              <div className="form-group">
                <label className="form-label">Tình trạng sách khi nhận lại</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="Ghi chú về tình trạng sách..."
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)} disabled={returning}>
                Hủy
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfirmReturn} disabled={returning}>
                {returning ? 'Đang hoàn tất...' : 'Xác nhận trả sách'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
