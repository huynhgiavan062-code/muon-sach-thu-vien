import { useState, useEffect, useCallback } from 'react';
import { reservationApi } from '../../api/reservationApi';
import { userApi } from '../../api/userApi';
import { bookApi } from '../../api/bookApi';
import { useToast } from '../../contexts/ToastContext';

export default function ReservationManagement() {
  const toast = useToast();

  const [reservations, setReservations] = useState([]);
  const [stats, setStats] = useState({ pendingCount: 0, readyCount: 0, fulfilledCount: 0, totalCount: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [readers, setReaders] = useState([]);
  const [books, setBooks] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await reservationApi.getReservationStats();
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchReservations = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await reservationApi.getReservations({
        page,
        limit: 10,
        search,
        status: statusFilter
      });
      setReservations(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách đặt trước.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReservations(1);
  }, [fetchReservations]);

  const handleOpenAdd = async () => {
    setSelectedUserId('');
    setSelectedBookId('');
    setNotes('');
    setShowAddModal(true);
    try {
      const [uRes, bRes] = await Promise.all([
        userApi.getUsers({ role: 'user', limit: 100 }),
        bookApi.getBooks({ limit: 100 })
      ]);
      setReaders(uRes.data || []);
      setBooks(bRes.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !selectedBookId) {
      toast.error('Vui lòng chọn độc giả và cuốn sách cần đặt trước.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await reservationApi.createReservation({
        user_id: selectedUserId,
        book_id: selectedBookId,
        notes
      });
      toast.success(res.message);
      setShowAddModal(false);
      fetchReservations(1);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đặt trước.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFulfill = async (item) => {
    if (!window.confirm(`Xác nhận bàn giao sách "${item.book_title}" cho độc giả ${item.user_full_name}?`)) {
      return;
    }
    try {
      const res = await reservationApi.fulfillReservation(item.id);
      toast.success(res.message);
      fetchReservations(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hoàn tất nhận sách.');
    }
  };

  const handleCancel = async (item) => {
    if (!window.confirm(`Bạn có chắc chắn muốn hủy lượt đặt trước cuốn "${item.book_title}"?`)) {
      return;
    }
    try {
      const res = await reservationApi.cancelReservation(item.id);
      toast.success(res.message);
      fetchReservations(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi hủy đặt trước.');
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Quản lý Đặt trước Sách</h1>
          <p className="page-subtitle">Theo dõi danh sách hàng chờ và sách đang giữ chỗ cho bạn đọc tại quầy</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <span>➕</span> Tạo lượt đặt trước
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-card-label">Sách sẵn sàng nhận</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {stats.readyCount}
          </span>
          <span className="stat-card-hint">Đang giữ tại quầy</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Đang chờ sách về</span>
          <span className="stat-card-value" style={{ color: 'var(--color-warning)' }}>
            {stats.pendingCount}
          </span>
          <span className="stat-card-hint">Trong hàng đợi</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Đã bàn giao</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {stats.fulfilledCount}
          </span>
          <span className="stat-card-hint">Hoàn tất mượn</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Tổng lượt đặt</span>
          <span className="stat-card-value">{stats.totalCount}</span>
          <span className="stat-card-hint">Toàn thời gian</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tìm kiếm</label>
            <input
              type="text"
              className="form-input"
              placeholder="Tên độc giả, mã thẻ, tên sách..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Trạng thái</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="ready">Sẵn sàng nhận</option>
              <option value="pending">Đang chờ sách</option>
              <option value="fulfilled">Đã bàn giao</option>
              <option value="cancelled">Đã hủy</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="loading-page" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách đặt trước...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchReservations(pagination.page)}>
            Thử lại
          </button>
        </div>
      ) : reservations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔖</div>
          <div className="empty-state-title">Không có lượt đặt trước nào</div>
          <p className="empty-state-text">
            {search || statusFilter ? 'Không tìm thấy kết quả phù hợp với bộ lọc.' : 'Hiện không có độc giả nào đặt trước sách.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Tên sách</th>
                  <th>Độc giả</th>
                  <th>Hàng đợi</th>
                  <th>Ngày đặt</th>
                  <th>Hạn giữ sách</th>
                  <th>Trạng thái</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const isReady = r.status === 'ready';
                  const isPending = r.status === 'pending';
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.book_title}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          Mã: {r.book_code} • Kệ: {r.shelf_code || 'Kho'}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500' }}>{r.user_full_name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {r.user_reader_code} {r.user_phone && `• ${r.user_phone}`}
                        </div>
                      </td>
                      <td>
                        {isPending ? (
                          <span className="badge badge-warning">Vị trí #{r.queue_position}</span>
                        ) : isReady ? (
                          <span className="badge badge-success">Ưu tiên nhận</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td>{r.reservation_date ? new Date(r.reservation_date).toLocaleDateString('vi-VN') : '—'}</td>
                      <td>
                        {r.expiry_date ? (
                          <strong style={{ color: 'var(--color-primary)' }}>{r.expiry_date}</strong>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>Đang chờ sách</span>
                        )}
                      </td>
                      <td>
                        {isReady ? (
                          <span className="badge badge-success">Sẵn sàng nhận</span>
                        ) : isPending ? (
                          <span className="badge badge-warning">Đang chờ</span>
                        ) : r.status === 'fulfilled' ? (
                          <span className="badge badge-info">Đã nhận</span>
                        ) : (
                          <span className="badge badge-neutral">Đã hủy</span>
                        )}
                      </td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          {isReady && (
                            <button
                              className="btn btn-primary btn-sm"
                              title="Bàn giao sách cho độc giả"
                              onClick={() => handleFulfill(r)}
                            >
                              ✓ Bàn giao
                            </button>
                          )}
                          {(isReady || isPending) && (
                            <button
                              className="btn btn-danger btn-sm"
                              title="Hủy đặt trước"
                              onClick={() => handleCancel(r)}
                            >
                              ✕ Hủy
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

          {pagination.totalPages > 1 && (
            <div className="pagination">
              <div className="pagination-info">
                Hiển thị <strong>{reservations.length}</strong> / <strong>{pagination.total}</strong> lượt đặt trước
              </div>
              <div className="pagination-controls">
                <button
                  className="pagination-btn"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchReservations(pagination.page - 1)}
                >
                  ‹
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                    onClick={() => fetchReservations(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  className="pagination-btn"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchReservations(pagination.page + 1)}
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal Add Reservation */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo lượt đặt trước sách</h3>
              <button className="modal-close" onClick={() => !submitting && setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Chọn độc giả *</label>
                  <select
                    className="form-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn độc giả --</option>
                    {readers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} ({u.reader_code || `@${u.username}`})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Chọn sách cần đặt trước *</label>
                  <select
                    className="form-select"
                    value={selectedBookId}
                    onChange={(e) => setSelectedBookId(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn cuốn sách --</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} ({b.book_code}) - Còn sẵn: {b.available_quantity} cuốn
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Ghi chú yêu cầu của độc giả..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang xử lý...' : 'Xác nhận đặt trước'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
