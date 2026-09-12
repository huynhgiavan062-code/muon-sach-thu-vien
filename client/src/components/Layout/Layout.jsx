import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './Layout.css';

const pageTitles = {
  '/admin': 'Tổng quan',
  '/admin/books': 'Quản lý Sách',
  '/admin/readers': 'Quản lý Độc giả',
  '/admin/borrow': 'Mượn / Trả sách',
  '/admin/borrow-records': 'Phiếu mượn',
  '/admin/reservations': 'Đặt trước',
  '/admin/fines': 'Tiền phạt',
  '/admin/imports': 'Nhập sách',
  '/admin/search': 'Tra cứu sách',
  '/admin/statistics': 'Thống kê',
  '/admin/reports': 'Báo cáo',
  '/admin/accounts': 'Quản lý Tài khoản',
  '/admin/settings': 'Cài đặt hệ thống',
  '/user': 'Trang chủ',
  '/user/search': 'Tra cứu sách',
  '/user/borrowed': 'Sách đang mượn',
  '/user/history': 'Lịch sử mượn',
  '/user/reservations': 'Đặt trước',
  '/user/fines': 'Tiền phạt',
  '/user/notifications': 'Thông báo',
  '/user/profile': 'Tài khoản cá nhân'
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const title = pageTitles[location.pathname] || '';

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Topbar
          title={title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
