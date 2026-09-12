import { useState, useEffect, useCallback } from 'react';
import { userApi } from '../../api/userApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function AccountManagement() {
  const { user: currentUser } = useAuth();
  const toast = useToast();

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  const [activeAccount, setActiveAccount] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const initialForm = {
    username: '',
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'admin'
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await userApi.getUsers({ role: 'admin', limit: 50 });
      setAccounts(res.data || []);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách tài khoản.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleOpenAdd = () => {
    setFormData(initialForm);
    setFormError('');
    setShowAddModal(true);
  };

  const handleOpenEdit = (acc) => {
    setActiveAccount(acc);
    setFormData({
      full_name: acc.full_name,
      email: acc.email,
      phone: acc.phone || '',
      role: acc.role
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleToggleStatus = async (acc) => {
    if (acc.id === currentUser?.id) {
      toast.error('Bạn không thể tự khóa tài khoản của chính mình!');
      return;
    }
    const newStatus = acc.status === 'active' ? 'locked' : 'active';
    try {
      await userApi.updateUserStatus(acc.id, newStatus);
      toast.success(`Đã cập nhật trạng thái tài khoản ${acc.full_name}!`);
      fetchAccounts();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi đổi trạng thái.');
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.username.trim() || !formData.email.trim() || !formData.full_name.trim()) {
      setFormError('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }
    if (!formData.password || formData.password.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      await userApi.createUser({ ...formData, role: 'admin' });
      toast.success('Tạo tài khoản quản trị mới thành công!');
      setShowAddModal(false);
      fetchAccounts();
    } catch (err) {
      setFormError(err.message || 'Lỗi khi tạo tài khoản.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    setSubmitting(true);
    try {
      await userApi.updateUser(activeAccount.id, formData);
      toast.success('Cập nhật tài khoản thành công!');
      setShowEditModal(false);
      fetchAccounts();
    } catch (err) {
      setFormError(err.message || 'Lỗi khi cập nhật.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      setFormError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      await userApi.resetUserPassword(activeAccount.id, newPassword);
      toast.success(`Đã đổi mật khẩu cho ${activeAccount.username}!`);
      setShowResetModal(false);
      setNewPassword('');
    } catch (err) {
      setFormError(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Quản lý Tài khoản Hệ thống</h1>
          <p className="page-subtitle">Danh sách tài khoản Quản trị viên và Cán bộ thư viện vận hành hệ thống</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <span>➕</span> Thêm tài khoản quản trị
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-page" style={{ minHeight: '250px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh sách tài khoản...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={fetchAccounts}>
            Thử lại
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Tên đăng nhập</th>
                <th>Họ và tên</th>
                <th>Email</th>
                <th>Số điện thoại</th>
                <th>Vai trò</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => {
                const isCurrent = acc.id === currentUser?.id;
                const isLocked = acc.status === 'locked';
                return (
                  <tr key={acc.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        @{acc.username}
                      </strong>
                      {isCurrent && <span className="badge badge-info" style={{ marginLeft: '6px' }}>Tôi</span>}
                    </td>
                    <td><strong>{acc.full_name}</strong></td>
                    <td>{acc.email}</td>
                    <td>{acc.phone || '—'}</td>
                    <td><span className="badge badge-neutral">Quản trị viên</span></td>
                    <td>
                      {acc.status === 'active' ? (
                        <span className="badge badge-success">Hoạt động</span>
                      ) : (
                        <span className="badge badge-error">Bị khóa</span>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                      {acc.created_at ? new Date(acc.created_at).toLocaleDateString('vi-VN') : '—'}
                    </td>
                    <td>
                      <div className="actions" style={{ justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Chỉnh sửa"
                          onClick={() => handleOpenEdit(acc)}
                        >
                          ✏
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          title="Đặt lại mật khẩu"
                          onClick={() => {
                            setActiveAccount(acc);
                            setNewPassword('');
                            setFormError('');
                            setShowResetModal(true);
                          }}
                        >
                          🔑
                        </button>
                        {!isCurrent && (
                          <button
                            className={`btn btn-sm ${isLocked ? 'btn-secondary' : 'btn-ghost'}`}
                            title={isLocked ? 'Mở khóa' : 'Khóa'}
                            onClick={() => handleToggleStatus(acc)}
                            style={{ color: isLocked ? 'var(--color-success)' : 'var(--color-warning)' }}
                          >
                            {isLocked ? '🔓' : '🔒'}
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
      )}

      {/* ==================== MODAL: ADD ACCOUNT ==================== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm tài khoản quản trị mới</h3>
              <button className="modal-close" onClick={() => !submitting && setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Họ và tên *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: Nguyễn Văn Cán Bộ"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Tên đăng nhập *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: admin_nhanvien"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Mật khẩu *</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Tối thiểu 6 ký tự"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="admin@library.edu.vn"
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
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang tạo...' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT ACCOUNT ==================== */}
      {showEditModal && activeAccount && (
        <div className="modal-overlay" onClick={() => !submitting && setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '500px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa tài khoản: {activeAccount.username}</h3>
              <button className="modal-close" onClick={() => !submitting && setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}
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

      {/* ==================== MODAL: RESET PASSWORD ==================== */}
      {showResetModal && activeAccount && (
        <div className="modal-overlay" onClick={() => !submitting && setShowResetModal(false)}>
          <div className="modal" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Đặt lại mật khẩu: {activeAccount.username}</h3>
              <button className="modal-close" onClick={() => !submitting && setShowResetModal(false)}>✕</button>
            </div>
            <form onSubmit={handleResetPasswordSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}
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
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetModal(false)} disabled={submitting}>
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
    </div>
  );
}
