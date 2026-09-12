import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminDashboard from './pages/admin/Dashboard';
import BookManagement from './pages/admin/BookManagement';
import ReaderManagement from './pages/admin/ReaderManagement';
import AccountManagement from './pages/admin/AccountManagement';
import BorrowDesk from './pages/admin/BorrowDesk';
import BorrowRecords from './pages/admin/BorrowRecords';
import ReservationManagement from './pages/admin/ReservationManagement';
import FineManagement from './pages/admin/FineManagement';
import ImportManagement from './pages/admin/ImportManagement';
import Statistics from './pages/admin/Statistics';
import Reports from './pages/admin/Reports';
import SystemSettings from './pages/admin/SystemSettings';
import BookSearch from './pages/common/BookSearch';
import UserDashboard from './pages/user/Dashboard';
import UserProfile from './pages/user/UserProfile';
import UserBorrowed from './pages/user/UserBorrowed';
import UserHistory from './pages/user/UserHistory';
import UserReservations from './pages/user/UserReservations';
import UserFines from './pages/user/UserFines';
import UserNotifications from './pages/user/UserNotifications';

function AppRoutes() {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="loading-page">
        <div className="spinner spinner-lg"></div>
        <span>Đang tải hệ thống...</span>
      </div>
    );
  }

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Register */}
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />
          ) : (
            <Register />
          )
        }
      />

      {/* Admin Routes */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requiredRole="admin">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="books" element={<BookManagement />} />
        <Route path="readers" element={<ReaderManagement />} />
        <Route path="accounts" element={<AccountManagement />} />
        <Route path="borrow" element={<BorrowDesk />} />
        <Route path="borrow-records" element={<BorrowRecords />} />
        <Route path="reservations" element={<ReservationManagement />} />
        <Route path="fines" element={<FineManagement />} />
        <Route path="imports" element={<ImportManagement />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<SystemSettings />} />
        <Route path="search" element={<BookSearch />} />
      </Route>

      {/* User Routes */}
      <Route
        path="/user"
        element={
          <ProtectedRoute requiredRole="user">
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<UserDashboard />} />
        <Route path="borrowed" element={<UserBorrowed />} />
        <Route path="history" element={<UserHistory />} />
        <Route path="reservations" element={<UserReservations />} />
        <Route path="fines" element={<UserFines />} />
        <Route path="notifications" element={<UserNotifications />} />
        <Route path="search" element={<BookSearch />} />
        <Route path="profile" element={<UserProfile />} />
      </Route>

      {/* Default redirect */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to={user?.role === 'admin' ? '/admin' : '/user'} replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
