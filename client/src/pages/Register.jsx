import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Login.css';

export default function Register() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: ''
  });

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.full_name.trim()) {
      errors.full_name = 'Vui lòng nhập họ và tên.';
    }

    if (!formData.email.trim()) {
      errors.email = 'Vui lòng nhập địa chỉ email.';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Địa chỉ email không hợp lệ.';
    }

    if (formData.phone && formData.phone.trim()) {
      const phoneRegex = /^[0-9+]{9,15}$/;
      if (!phoneRegex.test(formData.phone.trim())) {
        errors.phone = 'Số điện thoại không hợp lệ.';
      }
    }

    if (!formData.username.trim()) {
      errors.username = 'Vui lòng nhập tên đăng nhập.';
    } else if (formData.username.trim().length < 3) {
      errors.username = 'Tên đăng nhập phải có ít nhất 3 ký tự.';
    }

    if (!formData.password) {
      errors.password = 'Vui lòng nhập mật khẩu.';
    } else if (formData.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự.';
    }

    if (!formData.confirm_password) {
      errors.confirm_password = 'Vui lòng xác nhận mật khẩu.';
    } else if (formData.password !== formData.confirm_password) {
      errors.confirm_password = 'Mật khẩu xác nhận không khớp.';
    }

    if (!agreeTerms) {
      errors.agreeTerms = 'Vui lòng đồng ý với điều khoản sử dụng.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validate()) {
      return;
    }

    setLoading(true);
    try {
      const res = await register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim(),
        phone: formData.phone ? formData.phone.trim() : null,
        username: formData.username.trim(),
        password: formData.password,
        confirm_password: formData.confirm_password
      });

      toast.success(res.message || 'Đăng ký tài khoản thành công.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container" style={{ maxWidth: '980px', minHeight: '620px' }}>
        {/* Left Branding */}
        <div className="login-branding" style={{ padding: 'var(--space-xl)' }}>
          <div className="login-branding-content">
            <div className="login-brand-icon">📚</div>
            <h1 className="login-brand-title">THƯ VIỆN</h1>
            <h2 className="login-brand-subtitle">ĐẠI HỌC</h2>
            <p className="login-brand-desc" style={{ marginBottom: '16px' }}>
              Hệ thống Quản lý Thư viện Đại học
            </p>
            <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.75)', lineHeight: '1.6' }}>
              Đăng ký tài khoản độc giả để tra cứu hàng ngàn đầu sách, mượn trả tài liệu trực tuyến và theo dõi lịch sử đọc sách thuận tiện.
            </p>
            <div
              style={{
                marginTop: '24px',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '12px 14px',
                borderRadius: '8px',
                fontSize: '11px',
                textAlign: 'left',
                border: '1px solid rgba(255, 255, 255, 0.15)'
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: '4px', color: '#fff' }}>
                🔖 Mã thẻ độc giả tự động:
              </div>
              <div style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                Hệ thống sẽ tự động cấp mã định danh thư viện (DG-xxx) ngay sau khi đăng ký thành công.
              </div>
            </div>
            <div className="login-brand-footer" style={{ marginTop: '24px' }}>
              Library Management System
            </div>
          </div>
        </div>

        {/* Right Form Section */}
        <div className="login-form-section" style={{ padding: '24px 32px' }}>
          <div className="login-form-wrapper" style={{ maxWidth: '440px' }}>
            <div className="login-form-header" style={{ marginBottom: '16px' }}>
              <h2>Đăng ký tài khoản</h2>
              <p>Tạo tài khoản độc giả thư viện mới</p>
            </div>

            {error && (
              <div className="login-error">
                <span className="login-error-icon">⚠</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form" noValidate>
              {/* Họ và tên */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="full_name">
                  Họ và tên <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                </label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  className={`form-input ${fieldErrors.full_name ? 'form-input-error' : ''}`}
                  placeholder="VD: Nguyễn Văn A"
                  value={formData.full_name}
                  onChange={handleChange}
                  autoComplete="name"
                  autoFocus
                />
                {fieldErrors.full_name && (
                  <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.full_name}
                  </span>
                )}
              </div>

              {/* Grid: Email & Số điện thoại */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="email">
                    Email <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className={`form-input ${fieldErrors.email ? 'form-input-error' : ''}`}
                    placeholder="student@univ.edu.vn"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                  {fieldErrors.email && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                      {fieldErrors.email}
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="phone">
                    Số điện thoại
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className={`form-input ${fieldErrors.phone ? 'form-input-error' : ''}`}
                    placeholder="0912345678"
                    value={formData.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                  />
                  {fieldErrors.phone && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                      {fieldErrors.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Tên đăng nhập */}
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label" htmlFor="username">
                  Tên đăng nhập <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  className={`form-input ${fieldErrors.username ? 'form-input-error' : ''}`}
                  placeholder="Nhập tên tài khoản đăng nhập"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="username"
                />
                {fieldErrors.username && (
                  <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.username}
                  </span>
                )}
              </div>

              {/* Grid: Mật khẩu & Xác nhận mật khẩu */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="password">
                    Mật khẩu <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                  </label>
                  <div className="input-group">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`form-input ${fieldErrors.password ? 'form-input-error' : ''}`}
                      placeholder="Ít nhất 6 ký tự"
                      value={formData.password}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="input-group-append"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                      {fieldErrors.password}
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="confirm_password">
                    Xác nhận mật khẩu <span style={{ color: 'var(--color-danger, #ef4444)' }}>*</span>
                  </label>
                  <div className="input-group">
                    <input
                      id="confirm_password"
                      name="confirm_password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      className={`form-input ${fieldErrors.confirm_password ? 'form-input-error' : ''}`}
                      placeholder="Nhập lại mật khẩu"
                      value={formData.confirm_password}
                      onChange={handleChange}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="input-group-append"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? '🙈' : '👁'}
                    </button>
                  </div>
                  {fieldErrors.confirm_password && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                      {fieldErrors.confirm_password}
                    </span>
                  )}
                </div>
              </div>

              {/* Checkbox: Điều khoản */}
              <div style={{ margin: '14px 0 16px' }}>
                <label className="form-checkbox" style={{ fontSize: '12px', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => {
                      setAgreeTerms(e.target.checked);
                      if (fieldErrors.agreeTerms) setFieldErrors((prev) => ({ ...prev, agreeTerms: '' }));
                    }}
                    style={{ marginTop: '2px' }}
                  />
                  <span>
                    Tôi đồng ý với <span style={{ color: 'var(--color-primary)', fontWeight: 500 }}>Điều khoản sử dụng</span> và quy định mượn trả của Thư viện Đại học.
                  </span>
                </label>
                {fieldErrors.agreeTerms && (
                  <span style={{ fontSize: '11px', color: 'var(--color-danger, #ef4444)', marginTop: '2px', display: 'block' }}>
                    {fieldErrors.agreeTerms}
                  </span>
                )}
              </div>

              {/* Button Đăng Ký */}
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block login-btn"
                disabled={loading}
                style={{ marginBottom: '12px' }}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Đang đăng ký...
                  </>
                ) : (
                  'ĐĂNG KÝ'
                )}
              </button>

              {/* Link về Login */}
              <div style={{ textAlign: 'center', fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Đã có tài khoản? </span>
                <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Đăng nhập
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
