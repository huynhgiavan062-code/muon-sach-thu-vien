import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const adminMenu = [
  {
    group: 'THƢ VIỆN',
    items: [
      { path: '/admin', label: 'Tổng quan', icon: '◫', exact: true }
    ]
  },
  {
    group: 'QUẢN LÝ',
    items: [
      { path: '/admin/books', label: 'Sách', icon: '📖' },
      { path: '/admin/readers', label: 'Độc giả', icon: '👤' },
      { path: '/admin/borrow-requests', label: 'Yêu cầu mượn', icon: '📬' },
      { path: '/admin/borrow', label: 'Mượn / Trả', icon: '↔' },
      { path: '/admin/borrow-records', label: 'Phiếu mượn', icon: '📋' },
      { path: '/admin/reservations', label: 'Đặt trước', icon: '🔖' },
      { path: '/admin/fines', label: 'Tiền phạt', icon: '💰' },
      { path: '/admin/imports', label: 'Nhập sách', icon: '📥' }
    ]
  },
  {
    group: 'TRA CỨU',
    items: [
      { path: '/admin/search', label: 'Tra cứu sách', icon: '🔍' }
    ]
  },
  {
    group: 'BÁO CÁO',
    items: [
      { path: '/admin/statistics', label: 'Thống kê', icon: '📊' },
      { path: '/admin/reports', label: 'Báo cáo', icon: '📄' }
    ]
  },
  {
    group: 'HỆ THỐNG',
    items: [
      { path: '/admin/accounts', label: 'Tài khoản', icon: '⚙' },
      { path: '/admin/settings', label: 'Cài đặt', icon: '🔧' }
    ]
  }
];

const userMenu = [
  {
    group: '',
    items: [
      { path: '/user', label: 'Trang chủ', icon: '◫', exact: true }
    ]
  },
  {
    group: 'THƯ VIỆN',
    items: [
      { path: '/user/search', label: 'Tra cứu sách', icon: '🔍' },
      { path: '/user/borrowed', label: 'Sách đang mượn', icon: '📖' },
      { path: '/user/history', label: 'Lịch sử mượn', icon: '📋' },
      { path: '/user/reservations', label: 'Đặt trước', icon: '🔖' }
    ]
  },
  {
    group: 'TÀI KHOẢN',
    items: [
      { path: '/user/fines', label: 'Tiền phạt', icon: '💰' },
      { path: '/user/notifications', label: 'Thông báo', icon: '🔔' },
      { path: '/user/profile', label: 'Tài khoản', icon: '👤' }
    ]
  }
];

export default function Sidebar() {
  const { isAdmin } = useAuth();
  const location = useLocation();
  const menu = isAdmin ? adminMenu : userMenu;

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">📚</span>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-title">THƯ VIỆN</span>
            <span className="sidebar-logo-sub">ĐẠI HỌC</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {menu.map((section, idx) => (
          <div key={idx} className="sidebar-section">
            {section.group && (
              <div className="sidebar-section-title">{section.group}</div>
            )}
            <ul className="sidebar-menu">
              {section.items.map(item => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={item.exact}
                    className={({ isActive }) =>
                      `sidebar-link ${isActive ? 'active' : ''}`
                    }
                  >
                    <span className="sidebar-link-icon">{item.icon}</span>
                    <span className="sidebar-link-label">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
