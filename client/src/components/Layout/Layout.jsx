import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from '../common/CommandPalette';
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { isAdmin } = useAuth();
  const location = useLocation();

  const title = pageTitles[location.pathname] || '';

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Topbar
          title={title}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
          onOpenPalette={() => setPaletteOpen(true)}
        />
        <main className="app-content">
          <Outlet />
        </main>
      </div>

      {/* Global Admin Command Palette */}
      {isAdmin && (
        <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      )}

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
    </div>
  );
}
