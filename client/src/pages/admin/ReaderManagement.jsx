import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../../api/userApi';
import { useToast } from '../../contexts/ToastContext';

export default function ReaderManagement() {
  const toast = useToast();

  const [readers, setReaders] = useState([]);
  const [stats, setStats] = useState({ totalReaders: 0, activeReaders: 0, lockedReaders: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeReader, setActiveReader] = useState(null);
  const [readerProfileData, setReaderProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const initialForm = {
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    reader_code: '',
    address: '',
    date_of_birth: ''
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Fetch stats
  const fetchStats = async () => {
    try {
      const res = await userApi.getUserStats();
      if (res.stats) setStats(res.stats);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  // Fetch readers
  const fetchReaders = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getUsers({
        page,
        limit: 10,
        search,
        role: 'user',
        status: statusFilter
      });
      setReaders(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách độc giả.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReaders(1);
  }, [fetchReaders]);

  // Open Add Reader Modal with auto-generated code
  const handleOpenAdd = async () => {
    setFormData(initialForm);
    setFormError('');
    try {
      const codeRes = await userApi.getNextReaderCode();
      if (codeRes.nextCode) {
        setFormData((prev) => ({ ...prev, reader_code: codeRes.nextCode }));
      }
    } catch (err) {
      console.error(err);
    }
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (reader) => {
    setActiveReader(reader);
    setFormData({
      full_name: reader.full_name,
      email: reader.email,
      phone: reader.phone || '',
      reader_code: reader.reader_code || '',
      address: reader.address || '',
      date_of_birth: reader.date_of_birth || ''
    });
    setFormError('');
    setShowEditModal(true);
  };

  // Open Profile Modal (fetch active borrows & history)
  const handleOpenProfile = async (reader) => {
    setActiveReader(reader);
    setShowProfileModal(true);
    setProfileLoading(true);
    try {
      const data = await userApi.getReaderProfile(reader.id);
      setReaderProfileData(data);
    } catch (err) {
      toast.error('Không thể tải chi tiết hồ sơ độc giả.');
    } finally {
      setProfileLoading(false);
    }
  };

  // Toggle Lock/Unlock status
  const handleToggleStatus = async (reader) => {
    const newStatus = reader.status === 'active' ? 'locked' : 'active';
    const actionText = newStatus === 'locked' ? 'khóa' : 'mở khóa';
    try {
      await userApi.updateUserStatus(reader.id, newStatus);
      toast.success(`Đã ${actionText} tài khoản độc giả ${reader.full_name}!`);
      fetchReaders(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi cập nhật trạng thái.');
    }
  };

  // Submit Add Reader
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.username.trim()) {
      setFormError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Vui lòng nhập email.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Mật khẩu khởi tạo phải có ít nhất 6 ký tự.');
      return;
    }
    if (!formData.full_name.trim()) {
      setFormError('Vui lòng nhập họ và tên.');
      return;
    }

    setSubmitting(true);
    try {
      await userApi.createUser({ ...formData, role: 'user' });
      toast.success('Cấp thẻ độc giả mới thành công!');
      setShowAddModal(false);
      fetchReaders(1);
      fetchStats();
    } catch (err) {
      setFormError(err.message || 'Lỗi khi thêm độc giả.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Reader
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.full_name.trim()) {
      setFormError('Họ tên không được để trống.');
      return;
    }
    if (!formData.email.trim()) {
      setFormError('Email không được để trống.');
      return;
    }

    setSubmitting(true);
    try {
      await userApi.updateUser(activeReader.id, formData);
      toast.success('Cập nhật thông tin độc giả thành công!');
      setShowEditModal(false);
      fetchReaders(pagination.page);
    } catch (err) {
      setFormError(err.message || 'Lỗi khi cập nhật độc giả.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Reset Password
  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      await userApi.resetUserPassword(activeReader.id, newPassword);
      toast.success(`Đã đổi mật khẩu cho độc giả ${activeReader.full_name}!`);
      setShowResetPasswordModal(false);
      setNewPassword('');
    } catch (err) {
      setFormError(err.message || 'Lỗi khi đặt lại mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete Reader
  const handleDeleteConfirm = async () => {
    setSubmitting(true);
    try {
      await userApi.deleteUser(activeReader.id);
      toast.success('Đã xóa độc giả thành công!');
      setShowDeleteModal(false);
      fetchReaders(pagination.page);
      fetchStats();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa độc giả.');
      setShowDeleteModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Quản lý Độc giả</h1>
          <p className="page-subtitle">Danh sách bạn đọc, sinh viên và giảng viên được cấp thẻ mượn sách thư viện</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <span>➕</span> Cấp thẻ độc giả mới
          </button>
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat-card">
          <span className="stat-card-label">Tổng độc giả</span>
          <span className="stat-card-value">{stats.totalReaders}</span>
          <span className="stat-card-hint">Đã đăng ký trong hệ thống</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Đang hoạt động</span>
          <span className="stat-card-value" style={{ color: 'var(--color-success)' }}>
            {stats.activeReaders}
          </span>
          <span className="stat-card-hint">Được phép mượn sách</span>
        </div>
        <div className="stat-card">
          <span className="stat-card-label">Bị khóa / Ngưng</span>
          <span className="stat-card-value" style={{ color: 'var(--color-error)' }}>
            {stats.lockedReaders}
          </span>
          <span className="stat-card-hint">Tạm ngưng quyền mượn</span>
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
              placeholder="Mã thẻ, họ tên, email, SĐT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Trạng thái tài khoản</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="locked">Bị khóa</option>
              <option value="suspended">Tạm ngưng</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="loading-page" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách độc giả...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchReaders(pagination.page)}>
            Thử lại
          </button>
        </div>
      ) : readers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-title">Không tìm thấy độc giả nào</div>
          <p className="empty-state-text">
            {search || statusFilter ? 'Không có độc giả phù hợp với bộ lọc tìm kiếm.' : 'Chưa có độc giả nào trong hệ thống. Bấm "Cấp thẻ độc giả mới" để tạo.'}
          </p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã độc giả</th>
                  <th>Họ và tên</th>
                  <th>Thông tin liên lạc</th>
                  <th>Trạng thái</th>
                  <th>Đang mượn</th>
                  <th>Nợ phạt</th>
                  <th>Ngày đăng ký</th>
                  <th style={{ textAlign: 'right' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {readers.map((r) => {
                  const isLocked = r.status === 'locked';
                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                          {r.reader_code || '—'}
                        </strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                          {r.full_name}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          @{r.username}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 'var(--font-size-sm)' }}>{r.email}</div>
                        {r.phone && (
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            📞 {r.phone}
                          </div>
                        )}
                      </td>
                      <td>
                        {r.status === 'active' ? (
                          <span className="badge badge-success">Hoạt động</span>
                        ) : r.status === 'locked' ? (
                          <span className="badge badge-error">Bị khóa</span>
                        ) : (
                          <span className="badge badge-warning">Tạm ngưng</span>
                        )}
                      </td>
                      <td>
                        {r.active_borrows_count > 0 ? (
                          <span className="badge badge-info">{r.active_borrows_count} cuốn</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>0</span>
                        )}
                      </td>
                      <td>
                        {r.unpaid_fines > 0 ? (
                          <span style={{ color: 'var(--color-error)', fontWeight: 'bold' }}>
                            {r.unpaid_fines.toLocaleString('vi-VN')} đ
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-success)' }}>0 đ</span>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                        {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Xem hồ sơ và lịch sử mượn"
                            onClick={() => handleOpenProfile(r)}
                          >
                            👁
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Chỉnh sửa thông tin"
                            onClick={() => handleOpenEdit(r)}
                          >
                            ✏
                          </button>
                          <button
                            className={`btn btn-sm ${isLocked ? 'btn-secondary' : 'btn-ghost'}`}
                            title={isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                            onClick={() => handleToggleStatus(r)}
                            style={{ color: isLocked ? 'var(--color-success)' : 'var(--color-warning)' }}
                          >
                            {isLocked ? '🔓' : '🔒'}
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Đặt lại mật khẩu"
                            onClick={() => {
                              setActiveReader(r);
                              setNewPassword('');
                              setFormError('');
                              setShowResetPasswordModal(true);
                            }}
                          >
                            🔑
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            title="Xóa độc giả"
                            onClick={() => {
                              setActiveReader(r);
                              setShowDeleteModal(true);
                            }}
                          >
                            🗑
                          </button>
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
              Hiển thị <strong>{readers.length}</strong> / <strong>{pagination.total}</strong> độc giả
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchReaders(pagination.page - 1)}
              >
                ‹
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                  onClick={() => fetchReaders(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReaders(pagination.page + 1)}
              >
                ›
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== MODAL: ADD READER ==================== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Cấp thẻ độc giả mới</h3>
              <button className="modal-close" onClick={() => !submitting && setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mã độc giả *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.reader_code}
                      onChange={(e) => setFormData({ ...formData, reader_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Họ và tên *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: Trần Văn Bình"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Tên đăng nhập *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: tranbinh"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mật khẩu khởi tạo *</label>
                    <input
                      type="password"
                      className="form-input"
                      placeholder="Tối thiểu 6 ký tự"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="VD: binh@student.edu.vn"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số điện thoại</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="0912..."
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Ngày sinh</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ / Lớp - Khoa</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Khoa CNTT - K45..."
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo thẻ độc giả'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT READER ==================== */}
      {showEditModal && activeReader && (
        <div className="modal-overlay" onClick={() => !submitting && setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa thông tin: {activeReader.full_name}</h3>
              <button className="modal-close" onClick={() => !submitting && setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mã độc giả</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.reader_code}
                      onChange={(e) => setFormData({ ...formData, reader_code: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Họ và tên *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input
                      type="email"
                      className="form-input"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Số điện thoại</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Ngày sinh</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formData.date_of_birth}
                      onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Địa chỉ</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: READER PROFILE & HISTORY ==================== */}
      {showProfileModal && activeReader && (
        <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
          <div className="modal" style={{ maxWidth: '750px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Hồ sơ độc giả: {activeReader.full_name}</h3>
              <button className="modal-close" onClick={() => setShowProfileModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {profileLoading ? (
                <div style={{ textAlign: 'center', padding: '30px' }}>
                  <div className="spinner"></div>
                  <p style={{ marginTop: '10px' }}>Đang tải lịch sử mượn trả và tiền phạt...</p>
                </div>
              ) : (
                <>
                  {/* Personal info summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', background: 'var(--color-bg-warm)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '20px', fontSize: 'var(--font-size-sm)' }}>
                    <div><strong>Mã độc giả:</strong> {activeReader.reader_code || '—'}</div>
                    <div><strong>Tên đăng nhập:</strong> {activeReader.username}</div>
                    <div><strong>Email:</strong> {activeReader.email}</div>
                    <div><strong>SĐT:</strong> {activeReader.phone || '—'}</div>
                    <div><strong>Trạng thái:</strong> {activeReader.status}</div>
                    <div><strong>Địa chỉ:</strong> {activeReader.address || '—'}</div>
                  </div>

                  {/* Active Borrows */}
                  <div style={{ marginBottom: '20px' }}>
                    <h4 style={{ fontSize: '15px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📖 Sách đang mượn ({readerProfileData?.activeBorrows?.length || 0})
                    </h4>
                    {readerProfileData?.activeBorrows?.length === 0 ? (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                        Hiện không có sách nào đang mượn.
                      </p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Mã phiếu</th>
                              <th>Tên sách</th>
                              <th>Ngày mượn</th>
                              <th>Hạn trả</th>
                              <th>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {readerProfileData?.activeBorrows?.map((b, idx) => (
                              <tr key={idx}>
                                <td><code>{b.borrow_code}</code></td>
                                <td><strong>{b.title}</strong></td>
                                <td>{b.borrow_date}</td>
                                <td>
                                  <strong style={{ color: b.status === 'overdue' ? 'var(--color-error)' : 'inherit' }}>
                                    {b.due_date}
                                  </strong>
                                </td>
                                <td>
                                  {b.status === 'overdue' ? (
                                    <span className="badge badge-error">Quá hạn</span>
                                  ) : (
                                    <span className="badge badge-info">Đang mượn</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Fines */}
                  <div>
                    <h4 style={{ fontSize: '15px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      💰 Tiền phạt ({readerProfileData?.fines?.length || 0})
                    </h4>
                    {readerProfileData?.fines?.length === 0 ? (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
                        Không có khoản tiền phạt nào.
                      </p>
                    ) : (
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Lý do</th>
                              <th>Số tiền</th>
                              <th>Đã nộp</th>
                              <th>Trạng thái</th>
                            </tr>
                          </thead>
                          <tbody>
                            {readerProfileData?.fines?.map((f) => (
                              <tr key={f.id}>
                                <td>{f.reason}</td>
                                <td>{f.amount?.toLocaleString('vi-VN')} đ</td>
                                <td>{f.paid_amount?.toLocaleString('vi-VN')} đ</td>
                                <td>
                                  {f.status === 'paid' ? (
                                    <span className="badge badge-success">Đã nộp</span>
                                  ) : (
                                    <span className="badge badge-error">Chưa nộp</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowProfileModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: RESET PASSWORD ==================== */}
      {showResetPasswordModal && activeReader && (
        <div className="modal-overlay" onClick={() => !submitting && setShowResetPasswordModal(false)}>
          <div className="modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đặt lại mật khẩu</h3>
              <button className="modal-close" onClick={() => !submitting && setShowResetPasswordModal(false)}>✕</button>
            </div>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}
                <p style={{ fontSize: 'var(--font-size-sm)', marginBottom: '16px' }}>
                  Đặt mật khẩu mới cho tài khoản độc giả <strong>{activeReader.full_name}</strong> (@{activeReader.username}):
                </p>
                <div className="form-group">
                  <label className="form-label">Mật khẩu mới *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetPasswordModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang cập nhật...' : 'Cập nhật mật khẩu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: DELETE CONFIRMATION ==================== */}
      {showDeleteModal && activeReader && (
        <div className="modal-overlay" onClick={() => !submitting && setShowDeleteModal(false)}>
          <div className="modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận xóa độc giả</h3>
              <button className="modal-close" onClick={() => !submitting && setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '12px' }}>
                Bạn có chắc chắn muốn xóa hồ sơ độc giả <strong>{activeReader.full_name}</strong> ({activeReader.reader_code}) không?
              </p>
              <div style={{ padding: '10px 14px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                ⚠ Hệ thống sẽ từ chối xóa nếu độc giả đang còn sách mượn chưa trả hoặc còn tiền phạt chưa nộp.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)} disabled={submitting}>
                Hủy
              </button>
              <button type="button" className="btn btn-danger" onClick={handleDeleteConfirm} disabled={submitting}>
                {submitting ? 'Đang xóa...' : 'Xóa độc giả'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
