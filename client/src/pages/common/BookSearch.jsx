import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { bookApi } from '../../api/bookApi';
import { borrowApi } from '../../api/borrowApi';
import { borrowRequestApi } from '../../api/borrowRequestApi';
import { reservationApi } from '../../api/reservationApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import BookCover from '../../components/common/BookCover';

export default function BookSearch() {
  const { isUser, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 12, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [shelves, setShelves] = useState([]);

  // Search & Filter
  const [keyword, setKeyword] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState('');
  const [selectedShelf, setSelectedShelf] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Selected Book for Detail Modal & Borrow flow
  const [selectedBook, setSelectedBook] = useState(null);
  const [bookEligibility, setBookEligibility] = useState(null);
  const [loadingEligibility, setLoadingEligibility] = useState(false);
  const [showBorrowConfirm, setShowBorrowConfirm] = useState(false);
  const [borrowSubmitting, setBorrowSubmitting] = useState(false);

  // Fetch metadata once
  useEffect(() => {
    async function loadMeta() {
      try {
        const meta = await bookApi.getMetadata();
        setCategories(meta.categories || []);
        setAuthors(meta.authors || []);
        setShelves(meta.shelves || []);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMeta();
  }, []);

  // Fetch books
  const fetchBooks = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookApi.getBooks({
        page,
        limit: 12,
        search: keyword,
        category_id: selectedCategory,
        author_id: selectedAuthor,
        shelf_id: selectedShelf,
        availability: selectedAvailability,
        sortBy: 'title',
        sortOrder: 'ASC'
      });
      setBooks(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 12, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải kết quả tra cứu.');
    } finally {
      setLoading(false);
    }
  }, [keyword, selectedCategory, selectedAuthor, selectedShelf, selectedAvailability]);

  useEffect(() => {
    fetchBooks(1);
  }, [fetchBooks]);

  // Check eligibility whenever a book is selected for detail view
  useEffect(() => {
    if (selectedBook && isUser) {
      let isMounted = true;
      setLoadingEligibility(true);
      setBookEligibility(null);
      borrowApi.checkEligibility(selectedBook.id)
        .then((res) => {
          if (isMounted) {
            setBookEligibility(res.eligibility);
          }
        })
        .catch((err) => {
          console.error('Failed to check eligibility:', err);
          if (isMounted) {
            setBookEligibility({ can_borrow: false, reason: 'Không thể kiểm tra điều kiện mượn sách.' });
          }
        })
        .finally(() => {
          if (isMounted) setLoadingEligibility(false);
        });

      return () => {
        isMounted = false;
      };
    } else {
      setBookEligibility(null);
      setShowBorrowConfirm(false);
    }
  }, [selectedBook, isUser]);

  // Handle sending borrow request
  const handleConfirmBorrow = async () => {
    if (!selectedBook) return;
    setBorrowSubmitting(true);
    try {
      const res = await borrowRequestApi.createBorrowRequest({ book_id: selectedBook.id });
      toast.success(res.message || 'Yêu cầu mượn sách đã được gửi và đang chờ Admin xác nhận.');
      setShowBorrowConfirm(false);

      // Update eligibility to has_pending_request: true
      setBookEligibility({
        can_borrow: false,
        has_pending_request: true,
        reason: 'Bạn đã gửi yêu cầu mượn cuốn sách này và đang chờ Admin xác nhận.',
        pending_request: res.request
      });
    } catch (err) {
      toast.error(err.message || 'Lỗi khi gửi yêu cầu mượn sách.');
    } finally {
      setBorrowSubmitting(false);
    }
  };

  const handleReset = () => {
    setKeyword('');
    setSelectedCategory('');
    setSelectedAuthor('');
    setSelectedShelf('');
    setSelectedAvailability('');
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Tra cứu Sách Thư viện</h1>
        <p className="page-subtitle">
          Tìm kiếm tài liệu, giáo trình, sách tham khảo theo tiêu đề, tác giả, thể loại hoặc vị trí kệ
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              className="form-input"
              style={{ fontSize: '15px', padding: '12px 16px' }}
              placeholder="Nhập tên sách, mã sách, ISBN, tác giả cần tìm..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => fetchBooks(1)}>
            <span>🔍</span> Tìm kiếm
          </button>
          <button className="btn btn-secondary" onClick={handleReset}>
            Đặt lại bộ lọc
          </button>
        </div>

        {/* Detailed Filters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Thể loại</label>
            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">Tất cả thể loại</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tác giả</label>
            <select
              className="form-select"
              value={selectedAuthor}
              onChange={(e) => setSelectedAuthor(e.target.value)}
            >
              <option value="">Tất cả tác giả</option>
              {authors.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Vị trí kệ sách</label>
            <select
              className="form-select"
              value={selectedShelf}
              onChange={(e) => setSelectedShelf(e.target.value)}
            >
              <option value="">Tất cả các kệ</option>
              {shelves.map((s) => (
                <option key={s.id} value={s.id}>{s.code} ({s.location || s.name})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tình trạng sách</label>
            <select
              className="form-select"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
            >
              <option value="">Tất cả tình trạng</option>
              <option value="available">Chỉ sách còn sẵn</option>
              <option value="out_of_stock">Sách đã hết</option>
            </select>
          </div>
        </div>
      </div>

      {/* Control Bar: View Mode & Count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          Tìm thấy <strong>{pagination.total}</strong> kết quả phù hợp
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('grid')}
            title="Dạng lưới"
          >
            ⊞ Dạng thẻ
          </button>
          <button
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('table')}
            title="Dạng danh sách"
          >
            ☰ Danh sách
          </button>
        </div>
      </div>

      {/* Results View */}
      {loading ? (
        <div className="loading-page" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tìm kiếm tài liệu trong kho dữ liệu...</span>
        </div>
      ) : error ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div className="empty-state-title">Đã xảy ra lỗi</div>
          <p className="empty-state-text">{error}</p>
          <button className="btn btn-secondary btn-sm" onClick={() => fetchBooks(pagination.page)}>
            Thử lại
          </button>
        </div>
      ) : books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Không tìm thấy sách phù hợp</div>
          <p className="empty-state-text">
            Vui lòng thử tìm kiếm bằng từ khóa khác hoặc xóa bớt các bộ lọc để mở rộng kết quả.
          </p>
          <button className="btn btn-secondary btn-sm" onClick={handleReset}>
            Xóa bộ lọc
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* GRID VIEW */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '20px' }}>
          {books.map((book) => {
            const isAvailable = book.available_quantity > 0;
            return (
              <div
                key={book.id}
                style={{
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: 'var(--shadow-xs)',
                  transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--color-primary)' }}>
                      {book.book_code}
                    </span>
                    {isAvailable ? (
                      <span className="badge badge-success">Còn {book.available_quantity} cuốn</span>
                    ) : (
                      <span className="badge badge-error">Đang mượn hết</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 16px' }}>
                    <BookCover
                      src={book.cover_image}
                      title={book.title}
                      category={book.category_name}
                      size="lg"
                    />
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: '600', marginBottom: '6px', color: 'var(--color-text)', minHeight: '40px' }}>
                    {book.title}
                  </h3>

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Tác giả: <strong>{book.author_name || 'Nhiều tác giả'}</strong>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <span className="badge badge-neutral">{book.category_name || 'Khác'}</span>
                    {book.publish_year && <span className="badge badge-neutral">{book.publish_year}</span>}
                  </div>

                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', borderTop: '1px dashed var(--color-border)', paddingTop: '8px' }}>
                    Vị trí: <strong>{book.shelf_code || 'Chưa xếp'}</strong> ({book.shelf_location || 'Kho'})
                  </div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setSelectedBook(book)}
                  >
                    Chi tiết
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Mã sách</th>
                <th>Tên sách</th>
                <th>Tác giả</th>
                <th>Thể loại</th>
                <th>Vị trí kệ</th>
                <th>Tình trạng</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => {
                const isAvailable = book.available_quantity > 0;
                return (
                  <tr key={book.id}>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                        {book.book_code}
                      </strong>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <BookCover
                          src={book.cover_image}
                          title={book.title}
                          category={book.category_name}
                          size="sm"
                        />
                        <div>
                          <strong>{book.title}</strong>
                          {book.isbn && <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', display: 'block' }}>ISBN: {book.isbn}</span>}
                        </div>
                      </div>
                    </td>
                    <td>{book.author_name || '—'}</td>
                    <td><span className="badge badge-neutral">{book.category_name || '—'}</span></td>
                    <td>{book.shelf_code ? `${book.shelf_code} (${book.shelf_location || ''})` : '—'}</td>
                    <td>
                      {isAvailable ? (
                        <span className="badge badge-success">Còn {book.available_quantity} / {book.total_quantity}</span>
                      ) : (
                        <span className="badge badge-error">Hết sách</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedBook(book)}
                      >
                        👁 Xem
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination" style={{ marginTop: '20px' }}>
          <div className="pagination-info">
            Trang <strong>{pagination.page}</strong> / <strong>{pagination.totalPages}</strong>
          </div>
          <div className="pagination-controls">
            <button
              className="pagination-btn"
              disabled={pagination.page <= 1}
              onClick={() => fetchBooks(pagination.page - 1)}
            >
              ‹
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                onClick={() => fetchBooks(p)}
              >
                {p}
              </button>
            ))}
            <button
              className="pagination-btn"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchBooks(pagination.page + 1)}
            >
              ›
            </button>
          </div>
        </div>
      )}

      {/* Book Detail Modal */}
      {selectedBook && (
        <div className="modal-overlay" onClick={() => setSelectedBook(null)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thông tin tài liệu</h3>
              <button className="modal-close" onClick={() => setSelectedBook(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <BookCover
                  src={selectedBook.cover_image}
                  title={selectedBook.title}
                  category={selectedBook.category_name}
                  size="md"
                />
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: '6px' }}>{selectedBook.title}</h2>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Tác giả: <strong>{selectedBook.author_name || 'Chưa rõ'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-neutral">Mã: {selectedBook.book_code}</span>
                    <span className="badge badge-info">{selectedBook.category_name || 'Khác'}</span>
                    {selectedBook.available_quantity > 0 ? (
                      <span className="badge badge-success">Còn {selectedBook.available_quantity} cuốn sẵn sàng</span>
                    ) : (
                      <span className="badge badge-error">Hiện đang mượn hết</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'var(--color-bg-warm)', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                <div><strong>ISBN:</strong> {selectedBook.isbn || '—'}</div>
                <div><strong>Năm xuất bản:</strong> {selectedBook.publish_year || '—'}</div>
                <div><strong>Nhà xuất bản:</strong> {selectedBook.publisher_name || '—'}</div>
                <div><strong>Ngôn ngữ:</strong> {selectedBook.language || 'Tiếng Việt'}</div>
                <div style={{ gridColumn: 'span 2' }}>
                  <strong>Vị trí kệ:</strong> {selectedBook.shelf_code ? `${selectedBook.shelf_code} - ${selectedBook.shelf_name || ''} (${selectedBook.shelf_location || ''})` : '—'}
                </div>
              </div>

              {selectedBook.description && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Giới thiệu tóm tắt</h4>
                  <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.6', color: 'var(--color-text)' }}>
                    {selectedBook.description}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ flex: '1 1 100%', marginBottom: (bookEligibility?.reason ? '4px' : '0') }}>
                {isUser && bookEligibility && !bookEligibility.can_borrow && !bookEligibility.is_borrowing && !bookEligibility.is_out_of_stock && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-danger, #ef4444)', fontSize: '12px' }}>
                    ⚠ <strong>Không thể mượn:</strong> {bookEligibility.reason}
                  </div>
                )}
                {isUser && bookEligibility?.is_borrowing && (
                  <div style={{ padding: '8px 12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: 'var(--radius-sm)', color: 'var(--color-primary, #2563eb)', fontSize: '12px' }}>
                    📖 <strong>Đang mượn:</strong> {bookEligibility.reason}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', width: '100%', alignItems: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedBook(null)}>
                  Đóng
                </button>
                {isUser && (
                  loadingEligibility ? (
                    <button className="btn btn-primary" disabled>
                      <span className="spinner spinner-sm" style={{ marginRight: '6px' }}></span>
                      Đang kiểm tra...
                    </button>
                  ) : bookEligibility?.is_borrowing ? (
                    <button
                      className="btn btn-outline"
                      style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                      onClick={() => {
                        setSelectedBook(null);
                        navigate('/user/borrowed');
                      }}
                      title="Xem trong danh sách sách đang mượn"
                    >
                      📖 Đang mượn (Đi tới tủ sách) →
                    </button>
                  ) : bookEligibility?.has_pending_request ? (
                    <button
                      className="btn btn-secondary"
                      disabled
                      style={{ background: '#fef3c7', color: '#b45309', borderColor: '#fde68a', fontWeight: 600, cursor: 'not-allowed' }}
                      title={bookEligibility.reason}
                    >
                      🟡 Đang chờ Admin xác nhận
                    </button>
                  ) : selectedBook.available_quantity <= 0 ? (
                    <button
                      className="btn btn-primary"
                      style={{ background: '#d97706', borderColor: '#d97706' }}
                      onClick={async () => {
                        try {
                          const res = await reservationApi.createReservation({ book_id: selectedBook.id });
                          toast.success(res.message);
                          setSelectedBook(null);
                          fetchBooks(pagination.page);
                        } catch (err) {
                          toast.error(err.message || 'Lỗi khi đặt trước.');
                        }
                      }}
                    >
                      🔖 Đặt trước sách này
                    </button>
                  ) : !bookEligibility?.can_borrow ? (
                    <button
                      className="btn btn-secondary"
                      disabled
                      style={{ opacity: 0.65, cursor: 'not-allowed' }}
                      title={bookEligibility?.reason || 'Không đủ điều kiện mượn'}
                    >
                      🚫 Không thể mượn
                    </button>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowBorrowConfirm(true)}
                    >
                      📚 Mượn sách
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Borrow Request */}
      {showBorrowConfirm && selectedBook && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📚</span> Xác nhận mượn sách?
              </h3>
              <button className="modal-close" onClick={() => setShowBorrowConfirm(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 12px', fontSize: 'var(--font-size-base)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Bạn muốn gửi yêu cầu mượn sách này?
              </p>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 'var(--radius-md)', padding: '12px', marginBottom: '16px', color: '#1e40af', fontSize: '13px' }}>
                ℹ <strong>Lưu ý:</strong> Yêu cầu sẽ được Admin xác nhận trước khi sách được ghi nhận là đang mượn.
              </div>

              <div style={{ background: 'var(--color-bg-warm)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: 'var(--font-size-sm)' }}>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Tên sách: </span>
                  <strong style={{ color: 'var(--color-text-primary)' }}>{selectedBook.title}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Mã sách: </span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedBook.book_code}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Tác giả: </span>
                  <strong>{selectedBook.author_name || 'Nhiều tác giả'}</strong>
                </div>
                <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Thời gian gửi yêu cầu: </span>
                  <strong>Hiện tại (Server)</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-secondary)' }}>Thời hạn mượn dự kiến: </span>
                  <strong style={{ color: 'var(--color-primary)' }}>14 ngày (sau khi duyệt)</strong>
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowBorrowConfirm(false)}
                disabled={borrowSubmitting}
              >
                Hủy
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleConfirmBorrow}
                disabled={borrowSubmitting}
              >
                {borrowSubmitting ? (
                  <>
                    <span className="spinner spinner-sm" style={{ marginRight: '6px' }}></span>
                    Đang gửi yêu cầu...
                  </>
                ) : (
                  '✓ Gửi yêu cầu mượn'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
