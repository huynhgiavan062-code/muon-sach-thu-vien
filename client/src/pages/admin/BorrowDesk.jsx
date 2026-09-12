import { useState, useEffect } from 'react';
import { borrowApi } from '../../api/borrowApi';
import { userApi } from '../../api/userApi';
import { bookApi } from '../../api/bookApi';
import { useToast } from '../../contexts/ToastContext';

export default function BorrowDesk() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('borrow'); // 'borrow' | 'return'

  // Tab 1: Borrow State
  const [readers, setReaders] = useState([]);
  const [selectedReader, setSelectedReader] = useState(null);
  const [readerSearch, setReaderSearch] = useState('');
  const [availableBooks, setAvailableBooks] = useState([]);
  const [bookSearch, setBookSearch] = useState('');
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [notes, setNotes] = useState('');
  const [borrowDueDate, setBorrowDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [borrowSubmitting, setBorrowSubmitting] = useState(false);
  const [borrowSuccessInfo, setBorrowSuccessInfo] = useState(null);

  // Tab 2: Return State
  const [returnSearch, setReturnSearch] = useState('');
  const [searchingReturn, setSearchingReturn] = useState(false);
  const [activeBorrowRecords, setActiveBorrowRecords] = useState([]);
  const [selectedRecordToReturn, setSelectedRecordToReturn] = useState(null);
  const [conditionNotes, setConditionNotes] = useState('');
  const [returnSubmitting, setReturnSubmitting] = useState(false);
  const [returnSuccessInfo, setReturnSuccessInfo] = useState(null);

  // Load Readers
  useEffect(() => {
    async function loadReaders() {
      try {
        const res = await userApi.getUsers({ role: 'user', limit: 100 });
        setReaders(res.data || []);
      } catch (err) {
        console.error(err);
      }
    }
    loadReaders();
  }, []);

  // Load Books
  const searchBooks = async (query = '') => {
    try {
      const res = await bookApi.getBooks({ search: query, availability: 'available', limit: 20 });
      setAvailableBooks(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    searchBooks();
  }, []);

  // Load active borrow records for Return tab
  const loadActiveRecords = async (searchQuery = '') => {
    setSearchingReturn(true);
    try {
      const res = await borrowApi.getBorrowRecords({ search: searchQuery, limit: 30 });
      const activeOnly = (res.data || []).filter(r => r.status === 'borrowing' || r.status === 'overdue');
      setActiveBorrowRecords(activeOnly);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingReturn(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'return') {
      loadActiveRecords();
    }
  }, [activeTab]);

  // Handle Add Book to list
  const handleAddBookToBorrow = (book) => {
    if (selectedBooks.some((b) => b.id === book.id)) {
      toast.warning('Cuốn sách này đã có trong danh sách mượn.');
      return;
    }
    if (selectedBooks.length >= 5) {
      toast.warning('Mỗi phiếu chỉ được mượn tối đa 5 cuốn sách cùng lúc.');
      return;
    }
    setSelectedBooks([...selectedBooks, book]);
  };

  const handleRemoveBookFromBorrow = (bookId) => {
    setSelectedBooks(selectedBooks.filter((b) => b.id !== bookId));
  };

  // Submit Borrow Form
  const handleBorrowSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReader) {
      toast.error('Vui lòng chọn độc giả mượn sách.');
      return;
    }
    if (selectedBooks.length === 0) {
      toast.error('Vui lòng chọn ít nhất 1 cuốn sách để lập phiếu.');
      return;
    }

    setBorrowSubmitting(true);
    setBorrowSuccessInfo(null);
    try {
      const res = await borrowApi.createBorrow({
        user_id: selectedReader.id,
        book_ids: selectedBooks.map((b) => b.id),
        notes,
        custom_due_date: borrowDueDate
      });

      toast.success(`Lập phiếu mượn ${res.record.borrow_code} thành công!`);
      setBorrowSuccessInfo(res.record);
      setSelectedBooks([]);
      setNotes('');
      searchBooks();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi lập phiếu mượn.');
    } finally {
      setBorrowSubmitting(false);
    }
  };

  // Submit Return Form
  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRecordToReturn) {
      toast.error('Vui lòng chọn phiếu mượn cần trả.');
      return;
    }

    setReturnSubmitting(true);
    setReturnSuccessInfo(null);
    try {
      const res = await borrowApi.returnBorrow(selectedRecordToReturn.id, {
        condition_notes: conditionNotes
      });

      toast.success(res.message);
      setReturnSuccessInfo(res.returnDetails);
      setSelectedRecordToReturn(null);
      setConditionNotes('');
      loadActiveRecords();
      searchBooks();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thực hiện trả sách.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Filter readers for selection
  const filteredReaders = readers.filter((r) => {
    if (!readerSearch) return true;
    const s = readerSearch.toLowerCase();
    return (
      r.full_name?.toLowerCase().includes(s) ||
      r.reader_code?.toLowerCase().includes(s) ||
      r.username?.toLowerCase().includes(s)
    );
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Quầy Nghiệp vụ Mượn / Trả Sách</h1>
        <p className="page-subtitle">Thực hiện quy trình cấp phiếu mượn và tiếp nhận hoàn trả tài liệu thư viện</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid var(--color-border)', marginBottom: '24px' }}>
        <button
          className="btn"
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottom: activeTab === 'borrow' ? '3px solid var(--color-primary)' : 'none',
            background: activeTab === 'borrow' ? 'var(--color-surface)' : 'transparent',
            fontWeight: activeTab === 'borrow' ? 'bold' : 'normal',
            color: activeTab === 'borrow' ? 'var(--color-primary)' : 'var(--color-text-secondary)'
          }}
          onClick={() => setActiveTab('borrow')}
        >
          📖 Lập phiếu mượn sách mới
        </button>
        <button
          className="btn"
          style={{
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderBottom: activeTab === 'return' ? '3px solid var(--color-primary)' : 'none',
            background: activeTab === 'return' ? 'var(--color-surface)' : 'transparent',
            fontWeight: activeTab === 'return' ? 'bold' : 'normal',
            color: activeTab === 'return' ? 'var(--color-primary)' : 'var(--color-text-secondary)'
          }}
          onClick={() => setActiveTab('return')}
        >
          ↩ Tiếp nhận thu hồi / Trả sách
        </button>
      </div>

      {/* ==================== TAB 1: LẬP PHIẾU MƯỢN ==================== */}
      {activeTab === 'borrow' && (
        <div>
          {borrowSuccessInfo && (
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h4 style={{ color: 'var(--color-success)', marginBottom: '4px' }}>
                  ✓ Đã tạo phiếu mượn: <strong>{borrowSuccessInfo.borrow_code}</strong>
                </h4>
                <div style={{ fontSize: 'var(--font-size-sm)' }}>
                  Độc giả: <strong>{borrowSuccessInfo.user_full_name}</strong> ({borrowSuccessInfo.user_reader_code}) • Hạn trả: <strong>{borrowSuccessInfo.due_date}</strong>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setBorrowSuccessInfo(null)}
              >
                Đóng
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
            {/* Left Box: Reader Selection & Borrow Info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Step 1: Reader Select */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>1️⃣</span> Chọn độc giả
                </h3>

                <div className="form-group">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Tìm theo tên độc giả, mã DG, username..."
                    value={readerSearch}
                    onChange={(e) => setReaderSearch(e.target.value)}
                  />
                </div>

                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: '4px' }}>
                  {filteredReaders.map((r) => {
                    const isSelected = selectedReader?.id === r.id;
                    const isLocked = r.status === 'locked';
                    return (
                      <div
                        key={r.id}
                        onClick={() => !isLocked && setSelectedReader(r)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: isLocked ? 'not-allowed' : 'pointer',
                          background: isSelected ? 'var(--color-primary-bg)' : 'transparent',
                          opacity: isLocked ? 0.5 : 1,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '2px'
                        }}
                      >
                        <div>
                          <strong>{r.full_name}</strong>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: '6px' }}>
                            ({r.reader_code || `@${r.username}`})
                          </span>
                        </div>
                        <div>
                          {isLocked ? (
                            <span className="badge badge-error">Bị khóa</span>
                          ) : (
                            <span className="badge badge-neutral">Đang mượn: {r.active_borrows_count || 0}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedReader && (
                  <div style={{ marginTop: '14px', padding: '12px', background: 'var(--color-bg-warm)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
                    <div><strong>Độc giả đã chọn:</strong> {selectedReader.full_name}</div>
                    <div style={{ color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      Mã thẻ: {selectedReader.reader_code} • SĐT: {selectedReader.phone || '—'}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Date & Notes */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>2️⃣</span> Thời hạn & Ghi chú
                </h3>

                <div className="form-group">
                  <label className="form-label">Hạn trả sách *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={borrowDueDate}
                    onChange={(e) => setBorrowDueDate(e.target.value)}
                    required
                  />
                  <span className="form-hint">Mặc định: 14 ngày kể từ hôm nay</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Ghi chú phiếu mượn</label>
                  <textarea
                    className="form-input"
                    rows="2"
                    placeholder="Ghi chú về tình trạng sách hoặc mục đích mượn..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Right Box: Book Selection & Cart */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Selected books preview */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <h3 style={{ fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>3️⃣</span> Sách chọn mượn ({selectedBooks.length}/5)
                  </h3>
                  {selectedBooks.length > 0 && (
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedBooks([])}>
                      Xóa tất cả
                    </button>
                  )}
                </div>

                {selectedBooks.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-tertiary)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    Chưa có cuốn sách nào được chọn. Chọn sách từ danh mục bên dưới.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                    {selectedBooks.map((b) => (
                      <div
                        key={b.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: 'var(--color-bg-warm)',
                          borderRadius: 'var(--radius-md)'
                        }}
                      >
                        <div>
                          <strong>{b.title}</strong>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                            Mã: {b.book_code} • Kệ: {b.shelf_code || '—'}
                          </div>
                        </div>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleRemoveBookFromBorrow(b.id)}
                          title="Bỏ chọn"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="btn btn-primary btn-block btn-lg"
                  style={{ marginTop: '16px' }}
                  onClick={handleBorrowSubmit}
                  disabled={borrowSubmitting || !selectedReader || selectedBooks.length === 0}
                >
                  {borrowSubmitting ? 'Đang xử lý transaction...' : '✓ Xác nhận cấp phiếu mượn'}
                </button>
              </div>

              {/* Book catalogue list for fast pick */}
              <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
                <h4 style={{ fontSize: '15px', marginBottom: '10px' }}>Kho sách sẵn sàng</h4>
                <input
                  type="text"
                  className="form-input"
                  style={{ marginBottom: '12px' }}
                  placeholder="Gõ tìm sách nhanh theo tên, mã..."
                  value={bookSearch}
                  onChange={(e) => {
                    setBookSearch(e.target.value);
                    searchBooks(e.target.value);
                  }}
                />

                <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                  {availableBooks.map((b) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--color-border-light)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500', fontSize: 'var(--font-size-sm)' }}>{b.title}</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
                          {b.book_code} • Còn: {b.available_quantity} cuốn
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddBookToBorrow(b)}
                        disabled={selectedBooks.some((sb) => sb.id === b.id)}
                      >
                        {selectedBooks.some((sb) => sb.id === b.id) ? '✓ Đã chọn' : '+ Thêm'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: TIẾP NHẬN TRẢ SÁCH ==================== */}
      {activeTab === 'return' && (
        <div>
          {returnSuccessInfo && (
            <div
              style={{
                padding: '16px 20px',
                background: 'var(--color-success-bg)',
                border: '1px solid var(--color-success)',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <h4 style={{ color: 'var(--color-success)', marginBottom: '4px' }}>
                  ✓ Đã hoàn tất thu hồi sách cho phiếu: <strong>{returnSuccessInfo.borrow_code}</strong>
                </h4>
                <div style={{ fontSize: 'var(--font-size-sm)' }}>
                  Ngày trả: {returnSuccessInfo.return_date}
                  {returnSuccessInfo.fine_amount > 0 && (
                    <span style={{ color: 'var(--color-error)', fontWeight: 'bold', marginLeft: '12px' }}>
                      ⚠ Quá hạn {returnSuccessInfo.overdue_days} ngày. Tiền phạt: {returnSuccessInfo.fine_amount.toLocaleString('vi-VN')} đ
                    </span>
                  )}
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setReturnSuccessInfo(null)}
              >
                Đóng
              </button>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
            {/* Left Box: Active records list */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>
                Danh sách phiếu đang mượn & quá hạn
              </h3>

              <div className="form-group">
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo mã phiếu, tên độc giả, mã thẻ..."
                  value={returnSearch}
                  onChange={(e) => {
                    setReturnSearch(e.target.value);
                    loadActiveRecords(e.target.value);
                  }}
                />
              </div>

              {searchingReturn ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <div className="spinner"></div>
                </div>
              ) : activeBorrowRecords.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                  Không có phiếu mượn nào cần trả lúc này.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {activeBorrowRecords.map((r) => {
                    const isSelected = selectedRecordToReturn?.id === r.id;
                    const isOverdue = r.status === 'overdue';
                    return (
                      <div
                        key={r.id}
                        onClick={() => setSelectedRecordToReturn(r)}
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border-light)',
                          background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-surface)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>
                            {r.borrow_code}
                          </strong>
                          {isOverdue ? (
                            <span className="badge badge-error">Quá hạn</span>
                          ) : (
                            <span className="badge badge-info">Đang mượn</span>
                          )}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-sm)' }}>
                          Độc giả: <strong>{r.user_full_name}</strong> ({r.user_reader_code})
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                          Mượn ngày: {r.borrow_date} • Hạn trả: <strong style={{ color: isOverdue ? 'var(--color-error)' : 'inherit' }}>{r.due_date}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Box: Return Confirmation Form */}
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '14px' }}>Chi tiết thu hồi sách</h3>

              {!selectedRecordToReturn ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--color-text-tertiary)', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                  Chọn một phiếu mượn từ danh sách bên trái để tiến hành nhận trả sách.
                </div>
              ) : (
                <form onSubmit={handleReturnSubmit}>
                  <div style={{ background: 'var(--color-bg-warm)', padding: '14px', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ marginBottom: '6px' }}>
                      Mã phiếu: <strong style={{ fontFamily: 'monospace', color: 'var(--color-primary)' }}>{selectedRecordToReturn.borrow_code}</strong>
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      Độc giả: <strong>{selectedRecordToReturn.user_full_name}</strong> ({selectedRecordToReturn.user_reader_code})
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      Ngày mượn: {selectedRecordToReturn.borrow_date} • Hạn trả: <strong>{selectedRecordToReturn.due_date}</strong>
                    </div>
                    {selectedRecordToReturn.status === 'overdue' && (
                      <div style={{ color: 'var(--color-error)', fontWeight: 'bold', marginTop: '6px' }}>
                        ⚠ Phiếu này đã quá hạn! Hệ thống sẽ tự động tạo bản ghi phạt tương ứng.
                      </div>
                    )}
                  </div>

                  <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Các cuốn sách trong phiếu:</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
                    {selectedRecordToReturn.items?.map((item) => (
                      <div
                        key={item.detail_id}
                        style={{
                          padding: '8px 12px',
                          background: 'var(--color-surface)',
                          border: '1px solid var(--color-border-light)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 'var(--font-size-sm)'
                        }}
                      >
                        📖 <strong>{item.title}</strong> ({item.book_code}) - Vị trí: {item.shelf_code || 'Kho'}
                      </div>
                    ))}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Tình trạng sách khi trả / Ghi chú</label>
                    <textarea
                      className="form-input"
                      rows="2"
                      placeholder="VD: Sách còn nguyên vẹn, bìa tốt..."
                      value={conditionNotes}
                      onChange={(e) => setConditionNotes(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block btn-lg"
                    disabled={returnSubmitting}
                  >
                    {returnSubmitting ? 'Đang hoàn tất thu hồi...' : '✓ Xác nhận nhận trả sách'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
