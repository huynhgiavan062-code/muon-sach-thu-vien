import { useState, useEffect, useCallback } from 'react';
import { bookApi } from '../../api/bookApi';
import { useToast } from '../../contexts/ToastContext';
import BookCover from '../../components/common/BookCover';
import BookCoverUpload from '../../components/common/BookCoverUpload';

export default function BookManagement() {
  const toast = useToast();

  // State
  const [books, setBooks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Metadata for dropdowns
  const [categories, setCategories] = useState([]);
  const [authors, setAuthors] = useState([]);
  const [publishers, setPublishers] = useState([]);
  const [shelves, setShelves] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedAvailability, setSelectedAvailability] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('DESC');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [activeBook, setActiveBook] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form data for Add / Edit
  const initialForm = {
    book_code: '',
    title: '',
    isbn: '',
    author_id: '',
    category_id: '',
    publisher_id: '',
    shelf_id: '',
    publish_year: new Date().getFullYear(),
    language: 'Tiếng Việt',
    description: '',
    total_quantity: 1
  };
  const [formData, setFormData] = useState(initialForm);
  const [formError, setFormError] = useState('');

  // Trạng thái upload ảnh bìa
  const [selectedCoverFile, setSelectedCoverFile] = useState(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(null);
  const [coverRemoved, setCoverRemoved] = useState(false);

  const handleCoverFileSelect = (file) => {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setSelectedCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setCoverRemoved(false);
  };

  const handleCoverRemove = () => {
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }
    setSelectedCoverFile(null);
    setCoverPreviewUrl(null);
    setCoverRemoved(true);
  };

  // Fetch metadata once
  useEffect(() => {
    async function loadMetadata() {
      try {
        const meta = await bookApi.getMetadata();
        setCategories(meta.categories || []);
        setAuthors(meta.authors || []);
        setPublishers(meta.publishers || []);
        setShelves(meta.shelves || []);
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    }
    loadMetadata();
  }, []);

  // Fetch books
  const fetchBooks = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bookApi.getBooks({
        page,
        limit: 10,
        search,
        category_id: selectedCategory,
        availability: selectedAvailability,
        sortBy,
        sortOrder
      });
      setBooks(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Không thể tải danh sách sách.');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedAvailability, sortBy, sortOrder]);

  useEffect(() => {
    fetchBooks(1);
  }, [fetchBooks]);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchBooks(newPage);
    }
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setSelectedCoverFile(null);
    setCoverPreviewUrl(null);
    setCoverRemoved(false);
    setFormData(initialForm);
    setFormError('');
    setShowAddModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (book) => {
    if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    setSelectedCoverFile(null);
    setCoverPreviewUrl(null);
    setCoverRemoved(false);
    setActiveBook(book);
    setFormData({
      book_code: book.book_code,
      title: book.title,
      isbn: book.isbn || '',
      author_id: book.author_id || '',
      category_id: book.category_id || '',
      publisher_id: book.publisher_id || '',
      shelf_id: book.shelf_id || '',
      publish_year: book.publish_year || '',
      language: book.language || 'Tiếng Việt',
      description: book.description || '',
      total_quantity: book.total_quantity
    });
    setFormError('');
    setShowEditModal(true);
  };

  // Open View Detail Modal
  const handleOpenDetail = (book) => {
    setActiveBook(book);
    setShowDetailModal(true);
  };

  // Open Delete Modal
  const handleOpenDelete = (book) => {
    setActiveBook(book);
    setShowDeleteModal(true);
  };

  // Submit Add Book
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.book_code.trim()) {
      setFormError('Vui lòng nhập mã sách.');
      return;
    }
    if (!formData.title.trim()) {
      setFormError('Vui lòng nhập tên sách.');
      return;
    }
    if (Number(formData.total_quantity) <= 0) {
      setFormError('Số lượng sách phải lớn hơn 0.');
      return;
    }

    setSubmitting(true);
    try {
      let coverUrl = null;
      if (selectedCoverFile) {
        const uploadRes = await bookApi.uploadCover(selectedCoverFile);
        coverUrl = uploadRes.url;
      }

      await bookApi.createBook({
        ...formData,
        cover_image: coverUrl
      });
      toast.success('Thêm sách mới thành công!');
      setShowAddModal(false);
      fetchBooks(1);
    } catch (err) {
      setFormError(err.message || 'Lỗi khi thêm sách mới.');
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Edit Book
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.title.trim()) {
      setFormError('Vui lòng nhập tên sách.');
      return;
    }
    if (Number(formData.total_quantity) < 0) {
      setFormError('Tổng số lượng không hợp lệ.');
      return;
    }

    setSubmitting(true);
    try {
      let coverUrl = activeBook.cover_image;
      if (selectedCoverFile) {
        const uploadRes = await bookApi.uploadCover(selectedCoverFile);
        coverUrl = uploadRes.url;
      } else if (coverRemoved) {
        coverUrl = null;
      }

      await bookApi.updateBook(activeBook.id, {
        ...formData,
        cover_image: coverUrl
      });
      toast.success('Cập nhật thông tin sách thành công!');
      setShowEditModal(false);
      fetchBooks(pagination.page);
    } catch (err) {
      setFormError(err.message || 'Lỗi khi cập nhật sách.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete Book
  const handleDeleteConfirm = async () => {
    setSubmitting(true);
    try {
      await bookApi.deleteBook(activeBook.id);
      toast.success('Xóa sách thành công!');
      setShowDeleteModal(false);
      fetchBooks(pagination.page);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi xóa sách.');
      setShowDeleteModal(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Quản lý Sách</h1>
          <p className="page-subtitle">Quản lý toàn bộ danh mục, thông tin kho sách và vị trí lưu trữ trong thư viện</p>
        </div>
        <div>
          <button className="btn btn-primary" onClick={handleOpenAdd}>
            <span>➕</span> Thêm sách mới
          </button>
        </div>
      </div>

      {/* Filters Card */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '16px', marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {/* Search Box */}
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tìm kiếm</label>
            <input
              type="text"
              className="form-input"
              placeholder="Tên sách, mã sách, ISBN, tác giả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter */}
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

          {/* Availability Filter */}
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Tình trạng</label>
            <select
              className="form-select"
              value={selectedAvailability}
              onChange={(e) => setSelectedAvailability(e.target.value)}
            >
              <option value="">Tất cả tình trạng</option>
              <option value="available">Còn sách trong kho</option>
              <option value="out_of_stock">Đã hết sách</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>Sắp xếp theo</label>
            <select
              className="form-select"
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [by, order] = e.target.value.split('-');
                setSortBy(by);
                setSortOrder(order);
              }}
            >
              <option value="created_at-DESC">Mới thêm gần đây</option>
              <option value="title-ASC">Tên sách (A → Z)</option>
              <option value="publish_year-DESC">Năm XB (Mới nhất)</option>
              <option value="available_quantity-DESC">Số lượng sẵn có (Nhiều → Ít)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="loading-page" style={{ minHeight: '300px' }}>
          <div className="spinner spinner-lg"></div>
          <span>Đang tải danh mục sách...</span>
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
          <div className="empty-state-icon">📚</div>
          <div className="empty-state-title">Không tìm thấy sách nào</div>
          <p className="empty-state-text">
            {search || selectedCategory || selectedAvailability
              ? 'Không có kết quả nào khớp với bộ lọc hiện tại. Vui lòng thử tìm kiếm khác.'
              : 'Thư viện hiện chưa có đầu sách nào. Bấm "Thêm sách mới" để bắt đầu.'}
          </p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Mã sách</th>
                  <th>Thông tin sách</th>
                  <th>Thể loại</th>
                  <th>Vị trí kệ</th>
                  <th>Năm XB</th>
                  <th>Số lượng</th>
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
                            <div style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text)' }}>
                              {book.title}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                              Tác giả: {book.author_name || 'Chưa cập nhật'}
                              {book.isbn && ` • ISBN: ${book.isbn}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-neutral">
                          {book.category_name || 'Khác'}
                        </span>
                      </td>
                      <td>
                        {book.shelf_code ? (
                          <span style={{ fontSize: 'var(--font-size-sm)' }}>
                            <strong>{book.shelf_code}</strong> ({book.shelf_location || 'Khu vực chính'})
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                        )}
                      </td>
                      <td>{book.publish_year || '—'}</td>
                      <td>
                        <strong>{book.available_quantity}</strong> / {book.total_quantity}
                      </td>
                      <td>
                        {isAvailable ? (
                          <span className="badge badge-success">Sẵn sàng ({book.available_quantity})</span>
                        ) : (
                          <span className="badge badge-error">Hết sách</span>
                        )}
                      </td>
                      <td>
                        <div className="actions" style={{ justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Xem chi tiết"
                            onClick={() => handleOpenDetail(book)}
                          >
                            👁
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            title="Chỉnh sửa"
                            onClick={() => handleOpenEdit(book)}
                          >
                            ✏
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            title="Xóa sách"
                            onClick={() => handleOpenDelete(book)}
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
              Hiển thị <strong>{books.length}</strong> / <strong>{pagination.total}</strong> cuốn sách
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                title="Trang trước"
              >
                ‹
              </button>
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${p === pagination.page ? 'active' : ''}`}
                  onClick={() => handlePageChange(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                title="Trang sau"
              >
                ›
              </button>
            </div>
          </div>
        </>
      )}

      {/* ==================== MODAL: ADD BOOK ==================== */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => !submitting && setShowAddModal(false)}>
          <div className="modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Thêm sách mới vào thư viện</h3>
              <button className="modal-close" onClick={() => !submitting && setShowAddModal(false)}>✕</button>
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}

                <BookCoverUpload
                  selectedFile={selectedCoverFile}
                  previewUrl={coverPreviewUrl}
                  onFileSelect={handleCoverFileSelect}
                  onRemove={handleCoverRemove}
                  bookTitle={formData.title}
                  category={categories.find(c => c.id === Number(formData.category_id))?.name || ''}
                />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mã sách *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: BK-011"
                      value={formData.book_code}
                      onChange={(e) => setFormData({ ...formData, book_code: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tên sách *</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nhập tên sách..."
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mã ISBN</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="VD: 978-0132350884"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tác giả</label>
                    <select
                      className="form-select"
                      value={formData.author_id}
                      onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                    >
                      <option value="">-- Chọn tác giả --</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Thể loại</label>
                    <select
                      className="form-select"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">-- Chọn thể loại --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhà xuất bản</label>
                    <select
                      className="form-select"
                      value={formData.publisher_id}
                      onChange={(e) => setFormData({ ...formData, publisher_id: e.target.value })}
                    >
                      <option value="">-- Chọn NXB --</option>
                      {publishers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Vị trí kệ</label>
                    <select
                      className="form-select"
                      value={formData.shelf_id}
                      onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
                    >
                      <option value="">-- Chọn kệ --</option>
                      {shelves.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} ({s.location || s.name})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Năm xuất bản</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.publish_year}
                      onChange={(e) => setFormData({ ...formData, publish_year: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tổng số lượng *</label>
                    <input
                      type="number"
                      className="form-input"
                      min="1"
                      value={formData.total_quantity}
                      onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mô tả tóm tắt</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    placeholder="Nhập giới thiệu hoặc tóm tắt nội dung sách..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu...' : 'Lưu sách'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: EDIT BOOK ==================== */}
      {showEditModal && activeBook && (
        <div className="modal-overlay" onClick={() => !submitting && setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: '650px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chỉnh sửa thông tin: {activeBook.book_code}</h3>
              <button className="modal-close" onClick={() => !submitting && setShowEditModal(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    ⚠ {formError}
                  </div>
                )}

                <BookCoverUpload
                  currentCover={coverRemoved ? '' : activeBook.cover_image}
                  selectedFile={selectedCoverFile}
                  previewUrl={coverPreviewUrl}
                  onFileSelect={handleCoverFileSelect}
                  onRemove={handleCoverRemove}
                  bookTitle={formData.title}
                  category={categories.find(c => c.id === Number(formData.category_id))?.name || activeBook.category_name || ''}
                />

                <div className="form-group">
                  <label className="form-label">Tên sách *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Mã ISBN</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.isbn}
                      onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tác giả</label>
                    <select
                      className="form-select"
                      value={formData.author_id}
                      onChange={(e) => setFormData({ ...formData, author_id: e.target.value })}
                    >
                      <option value="">-- Chọn tác giả --</option>
                      {authors.map((a) => (
                        <option key={a.id} value={a.id}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Thể loại</label>
                    <select
                      className="form-select"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    >
                      <option value="">-- Chọn thể loại --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Nhà xuất bản</label>
                    <select
                      className="form-select"
                      value={formData.publisher_id}
                      onChange={(e) => setFormData({ ...formData, publisher_id: e.target.value })}
                    >
                      <option value="">-- Chọn NXB --</option>
                      {publishers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Vị trí kệ</label>
                    <select
                      className="form-select"
                      value={formData.shelf_id}
                      onChange={(e) => setFormData({ ...formData, shelf_id: e.target.value })}
                    >
                      <option value="">-- Chọn kệ --</option>
                      {shelves.map((s) => (
                        <option key={s.id} value={s.id}>{s.code} ({s.location || s.name})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Năm xuất bản</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.publish_year}
                      onChange={(e) => setFormData({ ...formData, publish_year: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tổng số lượng</label>
                    <input
                      type="number"
                      className="form-input"
                      min="0"
                      value={formData.total_quantity}
                      onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                      required
                    />
                    <span className="form-hint">
                      Đang mượn: {activeBook.total_quantity - activeBook.available_quantity} cuốn
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mô tả tóm tắt</label>
                  <textarea
                    className="form-input"
                    rows="3"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Đang lưu...' : 'Cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: VIEW DETAIL ==================== */}
      {showDetailModal && activeBook && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Chi tiết thông tin sách</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', marginBottom: '20px' }}>
                <BookCover
                  src={activeBook.cover_image}
                  title={activeBook.title}
                  category={activeBook.category_name}
                  size="md"
                />
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 'var(--font-size-xl)', marginBottom: '6px' }}>{activeBook.title}</h2>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                    Tác giả: <strong>{activeBook.author_name || 'Chưa rõ'}</strong>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span className="badge badge-neutral">Mã: {activeBook.book_code}</span>
                    <span className="badge badge-info">{activeBook.category_name || 'Khác'}</span>
                    {activeBook.available_quantity > 0 ? (
                      <span className="badge badge-success">Còn {activeBook.available_quantity} cuốn</span>
                    ) : (
                      <span className="badge badge-error">Hết sách</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: 'var(--color-bg-warm)', padding: '14px', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                <div><strong>ISBN:</strong> {activeBook.isbn || '—'}</div>
                <div><strong>Năm xuất bản:</strong> {activeBook.publish_year || '—'}</div>
                <div><strong>Nhà xuất bản:</strong> {activeBook.publisher_name || '—'}</div>
                <div><strong>Ngôn ngữ:</strong> {activeBook.language || 'Tiếng Việt'}</div>
                <div><strong>Vị trí kệ:</strong> {activeBook.shelf_code ? `${activeBook.shelf_code} (${activeBook.shelf_location || ''})` : '—'}</div>
                <div><strong>Tổng số bản:</strong> {activeBook.total_quantity} cuốn (đang mượn {activeBook.total_quantity - activeBook.available_quantity})</div>
              </div>

              {activeBook.description && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>Mô tả</h4>
                  <p style={{ fontSize: 'var(--font-size-sm)', lineHeight: '1.6', color: 'var(--color-text)' }}>
                    {activeBook.description}
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowDetailModal(false);
                  handleOpenEdit(activeBook);
                }}
              >
                ✏ Chỉnh sửa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL: DELETE CONFIRMATION ==================== */}
      {showDeleteModal && activeBook && (
        <div className="modal-overlay" onClick={() => !submitting && setShowDeleteModal(false)}>
          <div className="modal" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Xác nhận xóa sách</h3>
              <button className="modal-close" onClick={() => !submitting && setShowDeleteModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '12px' }}>
                Bạn có chắc chắn muốn xóa đầu sách <strong>"{activeBook.title}"</strong> ({activeBook.book_code}) không?
              </p>
              <div style={{ padding: '10px 14px', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                ⚠ Lưu ý: Hành động này không thể hoàn tác. Nếu sách đang có độc giả mượn, hệ thống sẽ từ chối xóa để đảm bảo toàn vẹn dữ liệu.
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
                disabled={submitting}
              >
                {submitting ? 'Đang xóa...' : 'Xóa sách'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
