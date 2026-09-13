import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookApi } from '../../api/bookApi';
import { userApi } from '../../api/userApi';

const ADMIN_PAGES = [
  { label: 'Tổng quan (Dashboard)', path: '/admin', icon: '◫', group: 'Trang quản trị' },
  { label: 'Quầy Mượn - Trả sách (POS Terminal)', path: '/admin/borrow', icon: '↔', group: 'Nghiệp vụ lưu thông' },
  { label: 'Theo dõi phiếu mượn', path: '/admin/borrow-records', icon: '📋', group: 'Nghiệp vụ lưu thông' },
  { label: 'Quản lý kho sách', path: '/admin/books', icon: '📖', group: 'Kho tài liệu' },
  { label: 'Quản lý độc giả', path: '/admin/readers', icon: '👤', group: 'Độc giả & Thẻ' },
  { label: 'Quản lý & Thu tiền phạt', path: '/admin/fines', icon: '💰', group: 'Tài chính & Phạt' },
  { label: 'Quản lý đặt trước sách', path: '/admin/reservations', icon: '🔖', group: 'Nghiệp vụ lưu thông' },
  { label: 'Lập phiếu nhập sách mới', path: '/admin/imports', icon: '📥', group: 'Kho tài liệu' },
  { label: 'Thống kê thư viện', path: '/admin/statistics', icon: '📊', group: 'Báo cáo & Thống kê' },
  { label: 'Xuất báo cáo nghiệp vụ', path: '/admin/reports', icon: '📄', group: 'Báo cáo & Thống kê' },
  { label: 'Quản lý tài khoản', path: '/admin/accounts', icon: '⚙', group: 'Hệ thống' },
  { label: 'Cài đặt quy định thư viện', path: '/admin/settings', icon: '🔧', group: 'Hệ thống' }
];

export default function CommandPalette({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle global shortcut Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger open via custom event or props if controlled
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live search books & readers when query changes
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const [booksRes, usersRes] = await Promise.allSettled([
          bookApi.getBooks({ search: query.trim(), limit: 4 }),
          userApi.getUsers({ search: query.trim(), limit: 4 })
        ]);

        const items = [];
        if (booksRes.status === 'fulfilled' && booksRes.value.data) {
          booksRes.value.data.forEach(b => {
            items.push({
              type: 'book',
              id: b.id,
              title: b.title,
              subtitle: `Mã: ${b.book_code} • Còn: ${b.available_quantity}/${b.total_quantity} bản`,
              icon: '📖',
              path: `/admin/books?search=${encodeURIComponent(b.book_code)}`
            });
          });
        }

        if (usersRes.status === 'fulfilled' && usersRes.value.data) {
          usersRes.value.data.forEach(u => {
            items.push({
              type: 'user',
              id: u.id,
              title: u.full_name,
              subtitle: `Thẻ: ${u.reader_code || '---'} • SĐT: ${u.phone || u.email}`,
              icon: '👤',
              path: `/admin/readers?search=${encodeURIComponent(u.reader_code || u.username)}`
            });
          });
        }

        setSearchResults(items);
        setSelectedIndex(0);
      } catch (err) {
        console.error(err);
      } finally {
        setSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter static pages
  const filteredPages = query.trim()
    ? ADMIN_PAGES.filter(p => p.label.toLowerCase().includes(query.toLowerCase()) || p.group.toLowerCase().includes(query.toLowerCase()))
    : ADMIN_PAGES;

  const totalItems = [...filteredPages, ...searchResults];

  const handleSelect = (item) => {
    onClose();
    navigate(item.path);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (totalItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + totalItems.length) % (totalItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalItems[selectedIndex]) {
        handleSelect(totalItems[selectedIndex]);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '80px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--color-surface, #ffffff)',
          width: '100%',
          maxWidth: '580px',
          borderRadius: '14px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-color, #e2e8f0)',
          overflow: 'hidden',
          animation: 'slideUp 0.15s ease'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border-color, #e2e8f0)', gap: '12px' }}>
          <span style={{ fontSize: '18px', color: 'var(--color-primary, #3b82f6)' }}>🔍</span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Tìm chức năng, tên sách, mã độc giả, số điện thoại... (Ctrl + K)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              fontSize: '15px',
              background: 'transparent',
              color: 'var(--text-primary, #0f172a)'
            }}
          />
          {searching ? (
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Đang tìm...</span>
          ) : (
            <span style={{ fontSize: '11px', background: 'var(--bg-secondary, #f1f5f9)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '8px' }}>
          {/* Live Search Items */}
          {searchResults.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 10px', textTransform: 'uppercase' }}>
                Kết quả tìm kiếm trực tiếp
              </div>
              {searchResults.map((item, idx) => {
                const isSelected = selectedIndex === idx + filteredPages.length;
                return (
                  <div
                    key={`search-${idx}`}
                    onClick={() => handleSelect(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)'
                    }}
                  >
                    <span style={{ fontSize: '18px' }}>{item.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {item.subtitle}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>↵ Chọn</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quick Page Links */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', padding: '4px 10px', textTransform: 'uppercase' }}>
              Chức năng quản trị
            </div>
            {filteredPages.map((page, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <div
                  key={page.path}
                  onClick={() => handleSelect(page)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                    color: isSelected ? 'var(--color-primary)' : 'var(--text-primary)'
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{page.icon}</span>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{page.label}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: '4px' }}>
                    {page.group}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer hints */}
        <div style={{ padding: '8px 16px', background: 'var(--bg-secondary, #f8fafc)', borderTop: '1px solid var(--border-color, #e2e8f0)', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span>Dùng phím <kbd style={{ padding: '2px 5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>↑</kbd> <kbd style={{ padding: '2px 5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>↓</kbd> để di chuyển</span>
          <span><kbd style={{ padding: '2px 5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>Enter</kbd> để chọn</span>
          <span><kbd style={{ padding: '2px 5px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '3px' }}>Esc</kbd> để đóng</span>
        </div>
      </div>
    </div>
  );
}
