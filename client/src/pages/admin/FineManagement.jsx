import { useState, useEffect, useCallback } from 'react';
import { fineApi } from '../../api/fineApi';
import { userApi } from '../../api/userApi';
import { useToast } from '../../contexts/ToastContext';

export default function FineManagement() {
  const toast = useToast();

  const [fines, setFines] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, total_unpaid: 0 });
  const [stats, setStats] = useState({
    total_fines: 0,
    total_amount: 0,
    total_collected: 0,
    total_unpaid: 0,
    count_unpaid: 0,
    count_paid: 0,
    count_partial: 0,
    readers_with_fines: 0
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Modals
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [readers, setReaders] = useState([]);
  const [newFine, setNewFine] = useState({
    user_id: '',
    reason: '',
    custom_reason: '',
    amount: '',
    overdue_days: 0,
    notes: ''
  });
  const [creating, setCreating] = useState(false);

  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fineApi.getFineStats();
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error('Error fetching fine stats:', err);
    }
  };

  const fetchFines = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fineApi.getFines({
        page,
        limit: 10,
        search,
        status: statusFilter,
        from_date: fromDate,
        to_date: toDate
      });
      setFines(res.data || []);
      setSummary(res.summary || { total_amount: 0, total_paid: 0, total_unpaid: 0 });
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách tiền phạt.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchFines(1);
  }, [fetchFines]);

  // Load readers list for Create Modal
  const loadReaders = async () => {
    try {
      const res = await userApi.getUsers({ role: 'user', limit: 100 });
      setReaders(res.data || []);
    } catch (err) {
      console.error('Error loading readers:', err);
    }
  };

  const handleOpenCreateModal = () => {
    loadReaders();
    setNewFine({
      user_id: '',
      reason: 'Quá hạn trả sách',
      custom_reason: '',
      amount: '',
      overdue_days: 0,
      notes: ''
    });
    setShowCreateModal(true);
  };

  const handleCreateFine = async (e) => {
    e.preventDefault();
    if (!newFine.user_id) {
      toast.error('Vui lòng chọn độc giả.');
      return;
    }
    const finalReason = newFine.reason === 'Khác' ? newFine.custom_reason : newFine.reason;
    if (!finalReason || !finalReason.trim()) {
      toast.error('Vui lòng nhập lý do phạt.');
      return;
    }
    if (!newFine.amount || Number(newFine.amount) <= 0) {
      toast.error('Số tiền phạt phải lớn hơn 0.');
      return;
    }

    setCreating(true);
    try {
      const res = await fineApi.createFine({
        user_id: newFine.user_id,
        reason: finalReason.trim(),
        amount: Number(newFine.amount),
        overdue_days: Number(newFine.overdue_days) || 0,
        notes: newFine.notes
      });
      toast.success(res.message || 'Lập phiếu phạt thành công.');
      setShowCreateModal(false);
      fetchFines(1);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lập phiếu phạt.');
    } finally {
      setCreating(false);
    }
  };

  // Open pay modal
  const handleOpenPayModal = (fine) => {
    setSelectedFine(fine);
    const remaining = fine.amount - (fine.paid_amount || 0);
    setPayAmount(remaining.toString());
    setPaymentMethod('Tiền mặt');
    setPayNotes('');
    setShowPayModal(true);
  };

  const handlePayFine = async (e) => {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      toast.error('Vui lòng nhập số tiền thu hợp lệ.');
      return;
    }

    const remaining = selectedFine.amount - (selectedFine.paid_amount || 0);
    if (Number(payAmount) > remaining) {
      toast.error(`Số tiền thu không được vượt quá số còn nợ (${remaining.toLocaleString('vi-VN')} đ).`);
      return;
    }

    setPaying(true);
    try {
      const res = await fineApi.payFine(selectedFine.id, {
        amount: Number(payAmount),
        payment_method: paymentMethod,
        notes: payNotes
      });
      toast.success(res.message || 'Đã thu tiền phạt thành công.');
      setShowPayModal(false);
      fetchFines(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xử lý thu tiền phạt.');
    } finally {
      setPaying(false);
    }
  };

  // Open detail modal
  const handleOpenDetailModal = (fine) => {
    setSelectedFine(fine);
    setShowDetailModal(true);
  };

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge badge-success">✓ Đã thanh toán</span>;
      case 'partial':
        return <span className="badge badge-warning">⚡ Nộp một phần</span>;
      case 'unpaid':
      default:
        return <span className="badge badge-danger">✕ Chưa thanh toán</span>;
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">Quản Lý Tiền Phạt</h1>
          <p className="page-subtitle">Theo dõi công nợ, phí bồi thường sách hỏng/mất và thu nộp tiền phạt độc giả</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleOpenCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <span>＋</span> Lập phiếu phạt mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card">
          <span className="stat-card-label">Tổng số phiếu phạt</span>
          <span className="stat-card-value" style={{ color: 'var(--color-primary)' }}>
            {stats.total_fines || 0}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {stats.readers_with_fines || 0} độc giả đang có nợ
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Tổng tiền phạt phát sinh</span>
          <span className="stat-card-value" style={{ color: 'var(--text-primary)' }}>
            {formatVND(stats.total_amount)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Lũy kế toàn hệ thống
          </span>
        </div>

        <div className="stat-card">
          <span className="stat-card-label">Đã thu vào quỹ</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success, #10b981)' }}>
            {formatVND(stats.total_collected)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--color-success, #10b981)' }}>
            {stats.count_paid || 0} phiếu hoàn tất
          </span>
        </div>

        <div className="stat-card" style={{ borderColor: stats.total_unpaid > 0 ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
          <span className="stat-card-label">Tiền phạt còn nợ</span>
          <span className="stat-card-value" style={{ color: 'var(--color-danger, #ef4444)' }}>
            {formatVND(stats.total_unpaid)}
          </span>
          <span className="stat-card-sub" style={{ fontSize: '12px', color: 'var(--color-danger, #ef4444)' }}>
            {stats.count_unpaid || 0} phiếu chưa thanh toán
          </span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Danh Sách Phiếu Phạt</h2>
          {summary && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span>Tổng phát sinh trang: <strong>{formatVND(summary.total_amount)}</strong></span>
              <span style={{ color: 'var(--color-success, #10b981)' }}>Đã thu: <strong>{formatVND(summary.total_paid)}</strong></span>
              <span style={{ color: 'var(--color-danger, #ef4444)' }}>Còn nợ: <strong>{formatVND(summary.total_unpaid)}</strong></span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: '1 1 240px', position: 'relative' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo mã ĐG, tên độc giả, mã phiếu, sách..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div style={{ minWidth: '160px' }}>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="unpaid">Chưa thanh toán</option>
              <option value="partial">Nộp một phần</option>
              <option value="paid">Đã thanh toán</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Từ:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '135px' }}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Đến:</span>
            <input
              type="date"
              className="form-control"
              style={{ width: '135px' }}
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>

          {(search || statusFilter || fromDate || toDate) && (
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setFromDate('');
                setToDate('');
              }}
            >
              Đặt lại lọc
            </button>
          )}
        </div>

        {/* Table */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner spinner-lg"></div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang tải danh sách phiếu phạt...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={() => fetchFines(1)} style={{ marginTop: '8px' }}>
                Thử lại
              </button>
            </div>
          ) : fines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>💰</div>
              <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Không có phiếu phạt nào phù hợp
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Không có độc giả nào bị phạt theo điều kiện tìm kiếm hiện tại.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã ĐG / Độc giả</th>
                    <th>Phiếu mượn / Sách</th>
                    <th>Lý do phạt</th>
                    <th style={{ textAlign: 'right' }}>Số tiền</th>
                    <th style={{ textAlign: 'right' }}>Đã nộp</th>
                    <th style={{ textAlign: 'right' }}>Còn nợ</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                    <th>Ngày lập</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((f) => {
                    const remaining = f.amount - (f.paid_amount || 0);
                    return (
                      <tr key={f.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                            {f.reader_code || '---'}
                          </div>
                          <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                            {f.reader_name}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {f.phone || f.email}
                          </div>
                        </td>

                        <td>
                          {f.borrow_code ? (
                            <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              📋 {f.borrow_code}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Không liên kết</span>
                          )}
                          {f.book_title && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={f.book_title}>
                              📖 {f.book_title}
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontWeight: 500 }}>{f.reason}</div>
                          {f.overdue_days > 0 && (
                            <div style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                              (Quá hạn {f.overdue_days} ngày)
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatVND(f.amount)}
                        </td>

                        <td style={{ textAlign: 'right', color: 'var(--color-success, #10b981)' }}>
                          {formatVND(f.paid_amount)}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600, color: remaining > 0 ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)' }}>
                          {formatVND(remaining)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {getStatusBadge(f.status)}
                        </td>

                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {f.created_at ? new Date(f.created_at).toLocaleDateString('vi-VN') : '---'}
                          {f.paid_date && (
                            <div style={{ fontSize: '11px', color: 'var(--color-success, #10b981)' }}>
                              Nộp: {new Date(f.paid_date).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {f.status !== 'paid' && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleOpenPayModal(f)}
                                title="Thu tiền phạt"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                              >
                                💵 Thu tiền
                              </button>
                            )}
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleOpenDetailModal(f)}
                              title="Chi tiết & Biên lai"
                              style={{ padding: '4px 8px', fontSize: '12px' }}
                            >
                              📄
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Hiển thị trang {pagination.page} / {pagination.totalPages} (Tổng {pagination.total} phiếu phạt)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchFines(pagination.page - 1)}
              >
                Trước
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchFines(pagination.page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Thu tiền phạt */}
      {showPayModal && selectedFine && (
        <div className="modal-backdrop" onClick={() => setShowPayModal(false)}>
          <div className="modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Thu Tiền Phạt</h3>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handlePayFine}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Độc giả:</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{selectedFine.reader_name} ({selectedFine.reader_code})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Lý do phạt:</span>
                    <span>{selectedFine.reason}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tổng mức phạt:</span>
                    <strong>{formatVND(selectedFine.amount)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Đã nộp trước đó:</span>
                    <span style={{ color: 'var(--color-success, #10b981)' }}>{formatVND(selectedFine.paid_amount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '6px' }}>
                    <span style={{ color: 'var(--color-danger, #ef4444)', fontWeight: 600 }}>Còn nợ:</span>
                    <strong style={{ color: 'var(--color-danger, #ef4444)', fontSize: '15px' }}>
                      {formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))}
                    </strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Số tiền thu đợt này (VNĐ) <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    type="number"
                    className="form-control"
                    min="1000"
                    max={selectedFine.amount - (selectedFine.paid_amount || 0)}
                    step="1000"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      style={{ fontSize: '11px', padding: '2px 8px' }}
                      onClick={() => setPayAmount((selectedFine.amount - (selectedFine.paid_amount || 0)).toString())}
                    >
                      Nộp toàn bộ ({formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))})
                    </button>
                    {selectedFine.amount - (selectedFine.paid_amount || 0) > 20000 && (
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                        onClick={() => setPayAmount('20000')}
                      >
                        Nộp trước 20.000 đ
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">Phương thức thanh toán</label>
                  <select
                    className="form-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Tiền mặt">💵 Tiền mặt tại quầy</option>
                    <option value="Chuyển khoản ngân hàng">🏦 Chuyển khoản ngân hàng</option>
                    <option value="Thẻ ATM / Thẻ ghi nợ">💳 Thẻ ATM / Quẹt máy POS</option>
                    <option value="Ví điện tử (MoMo / VNPAY)">📱 Ví MoMo / VNPAY</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú thu ngân / Mã giao dịch</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Mã giao dịch hoặc ghi chú của thủ thư..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPayModal(false)}
                  disabled={paying}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={paying}
                >
                  {paying ? 'Đang xử lý...' : '✓ Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Lập phiếu phạt mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Lập Phiếu Phạt Độc Giả</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateFine}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Chọn độc giả bị phạt <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={newFine.user_id}
                    onChange={(e) => setNewFine({ ...newFine, user_id: e.target.value })}
                    required
                  >
                    <option value="">-- Chọn độc giả --</option>
                    {readers.map((r) => (
                      <option key={r.id} value={r.id}>
                        [{r.reader_code || 'Chưa cấp'}] {r.full_name} - {r.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>
                    Lý do phạt <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <select
                    className="form-control"
                    value={newFine.reason}
                    onChange={(e) => setNewFine({ ...newFine, reason: e.target.value })}
                  >
                    <option value="Quá hạn trả sách">Quá hạn trả sách</option>
                    <option value="Làm hỏng sách / rách bìa">Làm hỏng sách / rách bìa</option>
                    <option value="Viết vẽ, bôi bẩn lên trang sách">Viết vẽ, bôi bẩn lên trang sách</option>
                    <option value="Làm mất sách (Bồi thường)">Làm mất sách (Bồi thường)</option>
                    <option value="Phí cấp lại thẻ thư viện do bị mất">Phí cấp lại thẻ thư viện do bị mất</option>
                    <option value="Vi phạm nội quy phòng đọc thư viện">Vi phạm nội quy phòng đọc thư viện</option>
                    <option value="Khác">Lý do khác...</option>
                  </select>
                </div>

                {newFine.reason === 'Khác' && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Chi tiết lý do khác <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Nhập lý do cụ thể..."
                      value={newFine.custom_reason}
                      onChange={(e) => setNewFine({ ...newFine, custom_reason: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Số tiền phạt (VNĐ) <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      min="1000"
                      step="1000"
                      placeholder="VD: 50000"
                      value={newFine.amount}
                      onChange={(e) => setNewFine({ ...newFine, amount: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số ngày quá hạn</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      placeholder="VD: 5"
                      value={newFine.overdue_days}
                      onChange={(e) => setNewFine({ ...newFine, overdue_days: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú bổ sung</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Tên ấn phẩm, mức độ hư hỏng hoặc căn cứ xử lý..."
                    value={newFine.notes}
                    onChange={(e) => setNewFine({ ...newFine, notes: e.target.value })}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Đang tạo...' : '＋ Lập phiếu phạt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chi tiết & Biên lai thu tiền */}
      {showDetailModal && selectedFine && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal-container" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Biên Lai & Chi Tiết Phiếu Phạt #{selectedFine.id}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body" id="printable-receipt">
              <div style={{ textAlign: 'center', borderBottom: '2px dashed var(--border-color)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  TRƯỜNG ĐẠI HỌC - THƯ VIỆN TRUNG TÂM
                </div>
                <div style={{ fontSize: '18px', fontWeight: 700, margin: '6px 0', color: 'var(--color-primary)' }}>
                  PHIẾU THU TIỀN PHẠT & BỒI THƯỜNG
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Số phiếu: <strong>FP-{String(selectedFine.id).padStart(6, '0')}</strong> | Ngày lập: {new Date(selectedFine.created_at).toLocaleDateString('vi-VN')}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', fontSize: '13px' }}>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Họ tên độc giả:</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFine.reader_name}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Mã số thẻ:</div>
                  <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{selectedFine.reader_code || '---'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Phiếu mượn gốc:</div>
                  <div style={{ fontWeight: 500 }}>{selectedFine.borrow_code || 'Không liên kết'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-secondary)' }}>Ấn phẩm liên quan:</div>
                  <div style={{ fontWeight: 500 }}>{selectedFine.book_title || 'N/A'}</div>
                </div>
              </div>

              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Lý do phạt:</span>
                  <strong>{selectedFine.reason}</strong>
                </div>
                {selectedFine.overdue_days > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', color: 'var(--color-danger)' }}>
                    <span>Thời gian quá hạn:</span>
                    <span>{selectedFine.overdue_days} ngày</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                  <span>Mức phạt quy định:</span>
                  <strong>{formatVND(selectedFine.amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px', color: 'var(--color-success, #10b981)' }}>
                  <span>Số tiền đã nộp:</span>
                  <strong>{formatVND(selectedFine.paid_amount)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '8px', fontSize: '15px' }}>
                  <span style={{ fontWeight: 600 }}>Còn nợ lại:</span>
                  <strong style={{ color: selectedFine.amount - (selectedFine.paid_amount || 0) > 0 ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #10b981)' }}>
                    {formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))}
                  </strong>
                </div>
              </div>

              {selectedFine.notes && (
                <div style={{ marginBottom: '16px', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nhật ký thu tiền & Ghi chú:</span>
                  <pre style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: '6px', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '12px', margin: 0 }}>
                    {selectedFine.notes}
                  </pre>
                </div>
              )}

              <div style={{ textAlign: 'center', marginTop: '16px' }}>
                <div style={{ display: 'inline-block', padding: '6px 16px', borderRadius: '20px', background: selectedFine.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                  {getStatusBadge(selectedFine.status)}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => window.print()}
              >
                🖨 In biên lai
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowDetailModal(false)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
