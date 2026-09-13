import { useState, useEffect, useCallback } from 'react';
import { borrowRequestApi } from '../../api/borrowRequestApi';
import { useToast } from '../../contexts/ToastContext';
import { formatDateTime } from '../../utils/formatters';

export default function BorrowRequests() {
  const toast = useToast();

  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected request for detail modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingRequestId, setRejectingRequestId] = useState(null);

  const fetchStats = async () => {
    try {
      const res = await borrowRequestApi.getBorrowRequestStats();
      setStats(res.stats || { pendingCount: 0, approvedCount: 0, rejectedCount: 0, totalCount: 0 });
    } catch (err) {
      console.error('Error fetching borrow request stats:', err);
    }
  };

  const fetchRequests = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await borrowRequestApi.getBorrowRequests({
        page,
        limit: 10,
        status: statusFilter,
        search: searchTerm
      });
      setRequests(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tải danh sách yêu cầu mượn.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    fetchStats();
    fetchRequests(1);
  }, [fetchRequests]);

  // Open Detail
  const handleOpenDetail = async (reqItem) => {
    try {
      const res = await borrowRequestApi.getBorrowRequestById(reqItem.id);
      setSelectedRequest(res.request);
    } catch (err) {
      toast.error('Lỗi khi tải chi tiết yêu cầu.');
    }
  };

  // Approve Request
  const handleApprove = async (requestId) => {
    if (!window.confirm('Bạn có chắc chắn muốn DUYỆT yêu cầu mượn sách này và lập phiếu mượn chính thức?')) {
      return;
    }
    setActionLoading(true);
    try {
      const res = await borrowRequestApi.approveBorrowRequest(requestId);
      toast.success(res.message || 'Đã duyệt yêu cầu mượn sách thành công!');
      setSelectedRequest(null);
      fetchRequests(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi duyệt yêu cầu.');
    } finally {
      setActionLoading(false);
    }
  };

  // Open Reject Dialog
  const handleOpenReject = (requestId) => {
    setRejectingRequestId(requestId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  // Submit Rejection
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error('Vui lòng nhập lý do từ chối.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await borrowRequestApi.rejectBorrowRequest(rejectingRequestId, rejectReason.trim());
      toast.success(res.message || 'Đã từ chối yêu cầu mượn sách.');
      setShowRejectModal(false);
      setSelectedRequest(null);
      fetchRequests(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi từ chối yêu cầu.');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning" style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a' }}>🟡 Chờ duyệt</span>;
      case 'approved':
        return <span className="badge badge-success">✓ Đã duyệt</span>;
      case 'rejected':
        return <span className="badge badge-error">✕ Đã từ chối</span>;
      case 'cancelled':
        return <span className="badge badge-neutral">Đã hủy</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quản Lý Yêu Cầu Mượn Sách</h1>
        <p className="page-subtitle">Xét duyệt và xử lý các yêu cầu mượn sách trực tuyến từ độc giả trước khi cấp phát tài liệu</p>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div 
          className="stat-card" 
          onClick={() => setStatusFilter('pending')}
          style={{ cursor: 'pointer', borderColor: statusFilter === 'pending' ? 'var(--color-warning, #f59e0b)' : undefined }}
        >
          <span className="stat-card-label">Yêu cầu chờ xử lý</span>
          <span className="stat-card-value" style={{ color: '#d97706' }}>
            {stats.pendingCount}
          </span>
          <span className="stat-card-hint">Cần Admin xác nhận</span>
        </div>
        <div 
          className="stat-card"
          onClick={() => setStatusFilter('approved')}
          style={{ cursor: 'pointer', borderColor: statusFilter === 'approved' ? 'var(--color-success)' : undefined }}
        >
          <span className="stat-card-label">Đã duyệt</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {stats.approvedCount}
          </span>
          <span className="stat-card-hint">Đã lập phiếu mượn</span>
        </div>
        <div 
          className="stat-card"
          onClick={() => setStatusFilter('rejected')}
          style={{ cursor: 'pointer', borderColor: statusFilter === 'rejected' ? 'var(--color-error)' : undefined }}
        >
          <span className="stat-card-label">Đã từ chối</span>
          <span className="stat-card-value" style={{ color: 'var(--color-error)' }}>
            {stats.rejectedCount}
          </span>
          <span className="stat-card-hint">Không đủ điều kiện</span>
        </div>
        <div 
          className="stat-card"
          onClick={() => setStatusFilter('')}
          style={{ cursor: 'pointer', borderColor: statusFilter === '' ? 'var(--color-primary)' : undefined }}
        >
          <span className="stat-card-label">Tổng yêu cầu</span>
          <span className="stat-card-value">{stats.totalCount}</span>
          <span className="stat-card-hint">Tất cả trạng thái</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tìm kiếm yêu cầu</label>
            <input
              type="text"
              className="form-input"
              placeholder="Mã yêu cầu, độc giả, tên sách..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Trạng thái</label>
            <select
              className="form-input"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">-- Tất cả trạng thái --</option>
              <option value="pending">🟡 Chờ duyệt (Pending)</option>
              <option value="approved">✓ Đã duyệt (Approved)</option>
              <option value="rejected">✕ Đã từ chối (Rejected)</option>
              <option value="cancelled">Đã hủy (Cancelled)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        {loading ? (
          <div className="loading-page" style={{ minHeight: '200px' }}>
            <div className="spinner spinner-lg"></div>
            <span>Đang tải danh sách yêu cầu mượn...</span>
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">Không có yêu cầu mượn nào</div>
            <p className="empty-state-text">
              {statusFilter === 'pending' ? 'Hiện tại không có yêu cầu nào đang chờ xử lý.' : 'Không tìm thấy yêu cầu mượn phù hợp với bộ lọc.'}
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã yêu cầu</th>
                  <th>Độc giả</th>
                  <th>Sách yêu cầu</th>
                  <th>Thời gian gửi</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {r.request_code}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{r.user_full_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        {r.user_reader_code}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500' }}>📖 {r.book_title}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                        Mã: {r.book_code} • Còn: {r.available_quantity} cuốn
                      </div>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {formatDateTime(r.requested_at)}
                    </td>
                    <td>{getStatusBadge(r.status)}</td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Xem chi tiết"
                          onClick={() => handleOpenDetail(r)}
                        >
                          👁 Xem
                        </button>
                        {r.status === 'pending' && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              title="Duyệt mượn sách"
                              onClick={() => handleApprove(r.id)}
                            >
                              ✓ Duyệt
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                              title="Từ chối yêu cầu"
                              onClick={() => handleOpenReject(r.id)}
                            >
                              ✕ Từ chối
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.totalPages > 1 && (
          <div className="pagination" style={{ padding: '16px', borderTop: '1px solid var(--color-border)' }}>
            <div className="pagination-info">
              Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong> ({pagination.total} yêu cầu)
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchRequests(pagination.page - 1)}
              >
                Trước
              </button>
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchRequests(pagination.page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋</span> Chi Tiết Yêu Cầu Mượn Sách
              </h3>
              <button className="modal-close" onClick={() => setSelectedRequest(null)}>×</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Request Status Bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--color-bg-warm)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Mã yêu cầu: </span>
                  <strong style={{ fontFamily: 'monospace', fontSize: '15px' }}>{selectedRequest.request_code}</strong>
                </div>
                <div>{getStatusBadge(selectedRequest.status)}</div>
              </div>

              {/* Reader Info Box */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--color-primary)' }}>👤 Thông Tin Độc Giả</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <div>Họ tên: <strong>{selectedRequest.user_full_name}</strong></div>
                  <div>Mã thẻ: <strong>{selectedRequest.user_reader_code}</strong></div>
                  <div>Email: {selectedRequest.user_email || '—'}</div>
                  <div>Số điện thoại: {selectedRequest.user_phone || '—'}</div>
                  <div>
                    Trạng thái thẻ: <span className="badge badge-success" style={{ fontSize: '10px' }}>{selectedRequest.user_status}</span>
                  </div>
                  <div>
                    Đang mượn: <strong>{selectedRequest.user_active_borrows_count || 0}</strong> / 5 cuốn
                  </div>
                  <div style={{ gridColumn: 'span 2' }}>
                    Nợ phạt hiện tại: <strong style={{ color: selectedRequest.user_unpaid_fines_total > 0 ? 'var(--color-error)' : 'inherit' }}>
                      {Number(selectedRequest.user_unpaid_fines_total || 0).toLocaleString('vi-VN')} đ
                    </strong>
                  </div>
                </div>
              </div>

              {/* Book Info Box */}
              <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '14px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--color-primary)' }}>📖 Thông Tin Ấn Phẩm</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    Tên sách: <strong>{selectedRequest.book_title}</strong>
                  </div>
                  <div>Mã sách: <strong>{selectedRequest.book_code}</strong></div>
                  <div>Tác giả: {selectedRequest.author_name || 'Nhiều tác giả'}</div>
                  <div>
                    Tồn kho khả dụng: <strong style={{ color: selectedRequest.available_quantity > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                      {selectedRequest.available_quantity} cuốn
                    </strong>
                  </div>
                  <div>Vị trí kệ: {selectedRequest.shelf_code || 'Kho lưu trữ'}</div>
                </div>
              </div>

              {/* Timestamp Details */}
              <div style={{ background: 'var(--color-bg-warm)', padding: '12px 14px', borderRadius: 'var(--radius-md)', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div>Thời gian gửi yêu cầu: <strong>{formatDateTime(selectedRequest.requested_at)}</strong></div>
                {selectedRequest.processed_at && (
                  <div>
                    Thời gian xử lý: <strong>{formatDateTime(selectedRequest.processed_at)}</strong> bởi <strong>{selectedRequest.processed_by_name || 'Admin'}</strong>
                  </div>
                )}
                {selectedRequest.rejection_reason && (
                  <div style={{ color: 'var(--color-error)', marginTop: '4px' }}>
                    Lý do từ chối: <em>"{selectedRequest.rejection_reason}"</em>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>
                Đóng
              </button>
              {selectedRequest.status === 'pending' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-outline"
                    style={{ borderColor: 'var(--color-error)', color: 'var(--color-error)' }}
                    onClick={() => handleOpenReject(selectedRequest.id)}
                    disabled={actionLoading}
                  >
                    ✕ Từ chối yêu cầu
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleApprove(selectedRequest.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Đang xử lý...' : '✓ Duyệt mượn sách'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {showRejectModal && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--color-error)' }}>Từ Chối Yêu Cầu Mượn</h3>
              <button className="modal-close" onClick={() => setShowRejectModal(false)}>×</button>
            </div>
            <form onSubmit={handleConfirmReject}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                  Vui lòng nhập lý do từ chối yêu cầu mượn sách này. Lý do sẽ được thông báo trực tiếp đến độc giả.
                </p>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600 }}>Lý do từ chối *</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Ví dụ: Sách đang được đưa đi phục chế / Độc giả đang có nợ quá hạn..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRejectModal(false)}
                  disabled={actionLoading}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ background: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
