import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import './Login.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Vui lòng nhập tên đăng nhập.');
      return;
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`Xin chào, ${user.full_name}!`);

      if (user.role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/user', { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Left - Branding */}
        <div className="login-branding">
          <div className="login-branding-content">
            <div className="login-brand-icon">📚</div>
            <h1 className="login-brand-title">THƯ VIỆN</h1>
            <h2 className="login-brand-subtitle">ĐẠI HỌC</h2>
            <p className="login-brand-desc">
              Hệ thống Quản lý Thư viện Đại học
            </p>
            <div className="login-brand-footer">
              Library Management System
            </div>
          </div>
        </div>

        {/* Right - Form */}
        <div className="login-form-section">
          <div className="login-form-wrapper">
            <div className="login-form-header">
              <h2>Đăng nhập</h2>
              <p>Nhập thông tin tài khoản để truy cập hệ thống</p>
            </div>

            {error && (
              <div className="login-error">
                <span className="login-error-icon">⚠</span>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="username">
                  Tên đăng nhập
                </label>
                <input
                  id="username"
                  type="text"
                  className="form-input"
                  placeholder="Nhập tên đăng nhập"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="password">
                  Mật khẩu
                </label>
                <div className="input-group">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Nhập mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
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
              </div>

              <div className="login-options">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <a href="#" className="login-forgot">Quên mật khẩu?</a>
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block login-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner"></span>
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>

              <div style={{ textAlign: 'center', margin: '12px 0 16px', fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>Chưa có tài khoản? </span>
                <Link to="/register" style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}>
                  Đăng ký
                </Link>
              </div>
            </form>

            <div className="login-demo-info">
              <p className="login-demo-title">Tài khoản demo</p>
              <div className="login-demo-accounts">
                <div className="login-demo-account">
                  <span className="login-demo-role">Admin</span>
                  <code>admin / admin123</code>
                </div>
                <div className="login-demo-account">
                  <span className="login-demo-role">User</span>
                  <code>user1 / user123</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
