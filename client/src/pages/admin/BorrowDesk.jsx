import { useState, useEffect, useRef } from 'react';
import { borrowApi } from '../../api/borrowApi';
import { userApi } from '../../api/userApi';
import { bookApi } from '../../api/bookApi';
import { fineApi } from '../../api/fineApi';
import { useToast } from '../../contexts/ToastContext';

export default function BorrowDesk() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('borrow'); // 'borrow' | 'return'

  // Scanner & Keyboard state
  const [universalCode, setUniversalCode] = useState('');
  const scannerInputRef = useRef(null);

  // Tab 1: Borrow State
  const [readers, setReaders] = useState([]);
  const [selectedReader, setSelectedReader] = useState(null);
  const [readerDetails, setReaderDetails] = useState(null);
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

  // Fine Payment Modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedFine, setSelectedFine] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Tiền mặt');
  const [payingFine, setPayingFine] = useState(false);

  // Load Readers
  const loadReaders = async () => {
    try {
      const res = await userApi.getUsers({ role: 'user', limit: 200 });
      setReaders(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Load Books
  const searchBooks = async (query = '') => {
    try {
      const res = await bookApi.getBooks({ search: query, availability: 'available', limit: 30 });
      setAvailableBooks(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

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
    loadReaders();
    searchBooks();
    loadActiveRecords();
    // Auto focus on scanner
    scannerInputRef.current?.focus();
  }, []);

  // Global Keyboard Shortcuts (F1, F2, F4, F9, Esc)
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('borrow');
        scannerInputRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('return');
        scannerInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (readerDetails?.fines && readerDetails.fines.length > 0) {
          const unpaid = readerDetails.fines.find(f => f.status !== 'paid');
          if (unpaid) handleOpenPayModal(unpaid);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (borrowSuccessInfo || returnSuccessInfo) {
          window.print();
        }
      } else if (e.key === 'Escape') {
        handleResetDesk();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerDetails, borrowSuccessInfo, returnSuccessInfo]);

  // Load full reader details whenever reader is selected
  const handleSelectReader = async (reader) => {
    setSelectedReader(reader);
    try {
      const res = await userApi.getReaderDetails(reader.id);
      setReaderDetails(res);
    } catch (err) {
      console.error(err);
    }
  };

  // Reset desk session
  const handleResetDesk = () => {
    setSelectedReader(null);
    setReaderDetails(null);
    setSelectedBooks([]);
    setNotes('');
    setUniversalCode('');
    setSelectedRecordToReturn(null);
    setBorrowSuccessInfo(null);
    setReturnSuccessInfo(null);
    scannerInputRef.current?.focus();
  };

  // Universal Scanner Input Handler (Auto-detect code)
  const handleUniversalScan = async (e) => {
    e.preventDefault();
    const code = universalCode.trim();
    if (!code) return;

    setUniversalCode('');

    // Case A: Reader Code (starts with DG or reader username/phone match)
    const matchedReader = readers.find(
      r => (r.reader_code && r.reader_code.toLowerCase() === code.toLowerCase()) ||
           r.username.toLowerCase() === code.toLowerCase() ||
           r.phone === code
    );

    if (matchedReader) {
      handleSelectReader(matchedReader);
      toast.success(`Đã nhận diện độc giả: ${matchedReader.full_name} (${matchedReader.reader_code})`);
      return;
    }

    // Case B: Book Code / ISBN in Return Mode
    if (activeTab === 'return') {
      try {
        const res = await borrowApi.getActiveBorrowByBook(code);
        if (res.record) {
          setSelectedRecordToReturn(res.record);
          toast.success(`Tìm thấy phiếu mượn ${res.record.borrow_code} cho sách "${code}"`);
        }
      } catch (err) {
        toast.error(`Không tìm thấy phiếu mượn đang hoạt động cho mã "${code}".`);
      }
      return;
    }

    // Case C: Book Code / ISBN in Borrow Mode
    const matchedBook = availableBooks.find(
      b => (b.book_code && b.book_code.toLowerCase() === code.toLowerCase()) ||
           (b.isbn && b.isbn.replace(/-/g, '') === code.replace(/-/g, ''))
    );

    if (matchedBook) {
      handleAddBookToBorrow(matchedBook);
      toast.success(`Đã thêm vào phiếu: "${matchedBook.title}"`);
    } else {
      // Try searching remote if not in top 30
      try {
        const res = await bookApi.getBooks({ search: code, availability: 'available', limit: 1 });
        if (res.data && res.data.length > 0) {
          handleAddBookToBorrow(res.data[0]);
          toast.success(`Đã thêm vào phiếu: "${res.data[0].title}"`);
        } else {
          toast.error(`Không tìm thấy sách có mã/ISBN "${code}" còn trong kho.`);
        }
      } catch (err) {
        toast.error(`Lỗi khi tìm sách: ${err.message}`);
      }
    }
  };

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
    setSelectedBooks(prev => [...prev, book]);
  };

  const handleRemoveBookFromBorrow = (bookId) => {
    setSelectedBooks(prev => prev.filter((b) => b.id !== bookId));
  };

  // Submit Borrow Form
  const handleBorrowSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReader) {
      toast.error('Vui lòng quét hoặc chọn độc giả mượn sách.');
      return;
    }
    if (selectedBooks.length === 0) {
      toast.error('Vui lòng quét hoặc chọn ít nhất 1 cuốn sách để lập phiếu.');
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

      setBorrowSuccessInfo(res.record);
      toast.success(res.message || 'Tạo phiếu mượn thành công!');

      // Refresh data
      setSelectedBooks([]);
      setNotes('');
      searchBooks();
      handleSelectReader(selectedReader);
      loadActiveRecords();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo phiếu mượn.');
    } finally {
      setBorrowSubmitting(false);
    }
  };

  // Instant Return from Reader profile or Return desk
  const handleExecuteReturn = async (recordId) => {
    setReturnSubmitting(true);
    setReturnSuccessInfo(null);
    try {
      const res = await borrowApi.returnBorrow(recordId, {
        condition_notes: conditionNotes
      });

      setReturnSuccessInfo(res.returnDetails);
      toast.success(res.message);

      setSelectedRecordToReturn(null);
      setConditionNotes('');
      loadActiveRecords();
      searchBooks();
      if (selectedReader) handleSelectReader(selectedReader);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi trả sách.');
    } finally {
      setReturnSubmitting(false);
    }
  };

  // Quick Pay Fine
  const handleOpenPayModal = (fine) => {
    setSelectedFine(fine);
    const remaining = fine.amount - (fine.paid_amount || 0);
    setPayAmount(remaining.toString());
    setPaymentMethod('Tiền mặt');
    setShowPayModal(true);
  };

  const handleConfirmPayFine = async (e) => {
    e.preventDefault();
    if (!selectedFine) return;
    setPayingFine(true);
    try {
      const res = await fineApi.payFine(selectedFine.id, {
        amount: Number(payAmount),
        payment_method: paymentMethod,
        notes: 'Thu trực tiếp tại Quầy mượn trả POS'
      });
      toast.success(res.message || 'Thu tiền phạt thành công!');
      setShowPayModal(false);
      if (selectedReader) handleSelectReader(selectedReader);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thu tiền phạt.');
    } finally {
      setPayingFine(false);
    }
  };

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div>
      {/* Header with Quick Shortcuts Bar */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title">Quầy Lưu Thông POS (One-Stop Terminal)</h1>
          <p className="page-subtitle">Bàn phục vụ Một Điểm Chạm: Mượn, Trả nhanh, Quản lý thẻ & Thu nợ phạt trực tiếp</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className={`btn btn-sm ${activeTab === 'borrow' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('borrow')}
          >
            <span>↔</span> F1: Mượn sách
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'return' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setActiveTab('return')}
          >
            <span>↩</span> F2: Trả siêu tốc
          </button>
          <button className="btn btn-outline btn-sm" onClick={handleResetDesk} title="Xóa trắng phiên (Esc)">
            🧹 Esc: Đổi bạn đọc
          </button>
        </div>
      </div>

      {/* 🚀 UNIVERSAL SMART SCANNER BAR (Máy quét mã vạch USB) */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          padding: '14px 20px',
          borderRadius: '12px',
          marginBottom: '20px',
          color: '#fff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '24px' }}>📟</span>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              MÁY QUÉT MÃ VẠCH TỰ ĐỘNG
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>
              Quét mã thẻ (DG-xxx) hoặc mã sách (BK-xxx / ISBN)
            </div>
          </div>
        </div>

        <form onSubmit={handleUniversalScan} style={{ flex: 1, display: 'flex', gap: '8px', minWidth: '280px' }}>
          <input
            ref={scannerInputRef}
            type="text"
            className="form-control"
            placeholder="Quét mã thẻ độc giả hoặc mã vạch sách rồi bấm Enter..."
            value={universalCode}
            onChange={(e) => setUniversalCode(e.target.value)}
            style={{
              background: '#020617',
              border: '1px solid #334155',
              color: '#38bdf8',
              fontFamily: 'monospace',
              fontSize: '15px',
              fontWeight: 600,
              padding: '10px 14px'
            }}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '0 20px', fontWeight: 600 }}>
            Quét (Enter)
          </button>
        </form>

        <div style={{ display: 'flex', gap: '6px', fontSize: '11px', color: '#cbd5e1' }}>
          <span style={{ background: '#334155', padding: '3px 8px', borderRadius: '4px' }}>F1: Mượn</span>
          <span style={{ background: '#334155', padding: '3px 8px', borderRadius: '4px' }}>F2: Trả</span>
          <span style={{ background: '#334155', padding: '3px 8px', borderRadius: '4px' }}>F4: Phạt</span>
          <span style={{ background: '#334155', padding: '3px 8px', borderRadius: '4px' }}>Esc: Hủy</span>
        </div>
      </div>

      {/* 3-COLUMN UNIFIED DESK LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* ================= COLUMN 1: ĐỘC GIẢ TẠI BÀN ================= */}
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>👤 Độc Giả Tại Bàn</h3>
            {selectedReader && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setSelectedReader(null); setReaderDetails(null); }}
                style={{ fontSize: '11px', padding: '2px 6px' }}
              >
                Đổi thẻ
              </button>
            )}
          </div>

          <div className="card-body">
            {!selectedReader ? (
              <div>
                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tìm theo mã thẻ, tên, số ĐT..."
                    value={readerSearch}
                    onChange={(e) => setReaderSearch(e.target.value)}
                  />
                </div>

                <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {readers
                    .filter(r => !readerSearch ||
                      r.full_name.toLowerCase().includes(readerSearch.toLowerCase()) ||
                      (r.reader_code && r.reader_code.toLowerCase().includes(readerSearch.toLowerCase())) ||
                      (r.phone && r.phone.includes(readerSearch))
                    )
                    .slice(0, 10)
                    .map(r => (
                      <div
                        key={r.id}
                        onClick={() => handleSelectReader(r)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          border: '1px solid transparent',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                      >
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '13px' }}>{r.full_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {r.reader_code || 'Chưa cấp'} • {r.phone || r.email}
                          </div>
                        </div>
                        <span className={`badge ${r.status === 'active' ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '10px' }}>
                          {r.status === 'active' ? 'Hợp lệ' : 'Bị khóa'}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div>
                {/* Active Reader Card Profile */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(16, 185, 129, 0.08) 100%)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '14px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '16px'
                      }}
                    >
                      {selectedReader.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                        {selectedReader.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-primary)', fontWeight: 600 }}>
                        Thẻ: {selectedReader.reader_code || '---'}
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div>Email: <strong>{selectedReader.email}</strong></div>
                    <div>SĐT: <strong>{selectedReader.phone || 'Chưa cập nhật'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <span className={`badge ${selectedReader.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
                      {selectedReader.status === 'active' ? '✓ Thẻ hợp lệ' : '✕ Thẻ bị khóa'}
                    </span>
                    {readerDetails?.stats?.unpaidFinesTotal > 0 && (
                      <span className="badge badge-danger">
                        Nợ phạt: {formatVND(readerDetails.stats.unpaidFinesTotal)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Sách bạn đọc đang giữ (với nút Trả nhanh ngay tại đây) */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                    Sách đang mượn ({readerDetails?.activeBorrows?.length || 0}/5):
                  </div>

                  {readerDetails?.activeBorrows?.length === 0 ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      Không giữ cuốn sách nào
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {readerDetails?.activeBorrows?.map((ab) => (
                        <div
                          key={ab.borrow_id}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: ab.status === 'overdue' ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-secondary)',
                            border: ab.status === 'overdue' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid var(--border-color)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {ab.title}
                            </div>
                            <div style={{ fontSize: '11px', color: ab.status === 'overdue' ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                              Hạn: {ab.due_date} {ab.status === 'overdue' && '(Quá hạn)'}
                            </div>
                          </div>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleExecuteReturn(ab.borrow_id)}
                            style={{ fontSize: '11px', padding: '3px 8px', flexShrink: 0 }}
                            title="Nhận trả cuốn này ngay"
                          >
                            ↩ Trả
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Nợ phạt của độc giả (với nút Thu phạt 1-Click) */}
                {readerDetails?.fines && readerDetails.fines.filter(f => f.status !== 'paid').length > 0 && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '12px', color: 'var(--color-danger)', fontWeight: 600, display: 'block' }}>
                          Công nợ tiền phạt:
                        </span>
                        <strong style={{ fontSize: '14px', color: 'var(--color-danger)' }}>
                          {formatVND(readerDetails.stats.unpaidFinesTotal)}
                        </strong>
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenPayModal(readerDetails.fines.find(f => f.status !== 'paid'))}
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                      >
                        💵 Thu phạt (F4)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: GIỎ MƯỢN SÁCH LƯỢT NÀY ================= */}
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>
              📚 Giỏ Mượn Sách ({selectedBooks.length}/5)
            </h3>
            {selectedBooks.length > 0 && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setSelectedBooks([])}
                style={{ fontSize: '11px', padding: '2px 6px' }}
              >
                Xóa giỏ
              </button>
            )}
          </div>

          <div className="card-body">
            {/* Book picker input */}
            <div className="form-group" style={{ marginBottom: '12px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Gõ tên sách hoặc mã sách cần mượn..."
                value={bookSearch}
                onChange={(e) => {
                  setBookSearch(e.target.value);
                  searchBooks(e.target.value);
                }}
              />
            </div>

            {/* Available books dropdown/scroll */}
            {bookSearch.trim() && (
              <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '12px', background: 'var(--bg-secondary)' }}>
                {availableBooks.slice(0, 6).map(b => (
                  <div
                    key={b.id}
                    onClick={() => { handleAddBookToBorrow(b); setBookSearch(''); }}
                    style={{
                      padding: '8px 10px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-color)',
                      fontSize: '12px',
                      display: 'flex',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <strong>[{b.book_code}]</strong> {b.title}
                    </div>
                    <span style={{ color: 'var(--color-success, #10b981)' }}>Còn {b.available_quantity} bản</span>
                  </div>
                ))}
              </div>
            )}

            {/* Selected books table */}
            <div style={{ minHeight: '180px', marginBottom: '14px' }}>
              {selectedBooks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)', border: '2px dashed var(--border-color)', borderRadius: '8px' }}>
                  <span style={{ fontSize: '28px', display: 'block', marginBottom: '6px' }}>📖</span>
                  <span>Chưa có sách nào trong giỏ mượn</span>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>Bắn mã vạch sách hoặc gõ tìm kiếm phía trên</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedBooks.map((b, idx) => (
                    <div
                      key={b.id}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {idx + 1}. {b.title}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Mã: {b.book_code} • Kệ: {b.shelf_code || '---'}
                        </div>
                      </div>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => handleRemoveBookFromBorrow(b.id)}
                        style={{ padding: '2px 8px', color: 'var(--color-danger)' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Due date & confirmation */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Hạn trả sách (14 ngày):
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={borrowDueDate}
                    onChange={(e) => setBorrowDueDate(e.target.value)}
                    style={{ fontSize: '13px', padding: '6px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Ghi chú mượn:
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Tình trạng sách..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ fontSize: '13px', padding: '6px 10px' }}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBorrowSubmit}
                disabled={borrowSubmitting || !selectedReader || selectedBooks.length === 0}
                style={{ width: '100%', padding: '12px', fontSize: '15px', fontWeight: 700 }}
              >
                {borrowSubmitting ? 'Đang lập phiếu...' : '✓ XÁC NHẬN CHO MƯỢN (Enter)'}
              </button>
            </div>
          </div>
        </div>

        {/* ================= COLUMN 3: QUẦY TRẢ SIÊU TỐC & PHIẾU GIAO DỊCH ================= */}
        <div className="card" style={{ height: '100%' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0, fontSize: '15px' }}>
              ⚡ Trả Sách Siêu Tốc
            </h3>
            {returnSuccessInfo && (
              <button className="btn btn-outline btn-sm" onClick={() => window.print()} style={{ fontSize: '11px', padding: '2px 6px' }}>
                🖨 In phiếu
              </button>
            )}
          </div>

          <div className="card-body">
            {/* Quick Return Mode Inspection */}
            {selectedRecordToReturn ? (
              <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{selectedRecordToReturn.borrow_code}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setSelectedRecordToReturn(null)}
                    style={{ fontSize: '10px', padding: '2px 5px' }}
                  >
                    ✕ Hủy
                  </button>
                </div>

                <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                  Độc giả: <strong>{selectedRecordToReturn.user_full_name}</strong> ({selectedRecordToReturn.user_reader_code})
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  Hạn trả: <strong>{selectedRecordToReturn.due_date}</strong>
                  {selectedRecordToReturn.status === 'overdue' && (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 600, display: 'block', marginTop: '2px' }}>
                      ⚠️ Đã quá hạn trả sách!
                    </span>
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: '12px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>Tình trạng sách khi nhận lại:</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Sách nguyên vẹn, bìa tốt..."
                    value={conditionNotes}
                    onChange={(e) => setConditionNotes(e.target.value)}
                    style={{ fontSize: '12px', padding: '6px' }}
                  />
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleExecuteReturn(selectedRecordToReturn.id)}
                  disabled={returnSubmitting}
                  style={{ width: '100%', padding: '10px', fontWeight: 700 }}
                >
                  {returnSubmitting ? 'Đang xử lý...' : '✓ HOÀN TẤT NHẬN TRẢ (F2)'}
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Danh sách phiếu đang mượn cần thu hồi:
                </div>
                <div style={{ maxHeight: '240px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {activeBorrowRecords.slice(0, 6).map(rec => (
                    <div
                      key={rec.id}
                      onClick={() => setSelectedRecordToReturn(rec)}
                      style={{
                        padding: '8px 10px',
                        background: rec.status === 'overdue' ? 'rgba(239, 68, 68, 0.05)' : 'var(--bg-secondary)',
                        border: rec.status === 'overdue' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '12px' }}>{rec.borrow_code}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{rec.user_full_name}</div>
                      </div>
                      <span className={`badge ${rec.status === 'overdue' ? 'badge-danger' : 'badge-primary'}`} style={{ fontSize: '10px' }}>
                        {rec.status === 'overdue' ? 'Quá hạn' : 'Đang mượn'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Thermal Print Slip Preview (Phiếu in nhiệt 80mm) */}
            {borrowSuccessInfo && (
              <div
                id="printable-slip"
                style={{
                  background: '#fff',
                  color: '#000',
                  padding: '14px',
                  borderRadius: '6px',
                  border: '1px dashed #94a3b8',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              >
                <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '6px', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 700 }}>THƯ VIỆN ĐẠI HỌC</div>
                  <div style={{ fontSize: '10px' }}>PHIẾU HẸN TRẢ TÀI LIỆU</div>
                  <div>Mã: {borrowSuccessInfo.borrow_code}</div>
                </div>
                <div>Độc giả: {borrowSuccessInfo.user_full_name}</div>
                <div>Hạn trả: <strong>{borrowSuccessInfo.due_date}</strong></div>
                <div style={{ marginTop: '6px', borderTop: '1px dashed #000', paddingTop: '4px', textAlign: 'center', fontSize: '10px' }}>
                  Vui lòng giữ phiếu này & trả sách đúng hạn!
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Thu Tiền Phạt Nhanh (F4) */}
      {showPayModal && selectedFine && (
        <div className="modal-backdrop" onClick={() => setShowPayModal(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Thu Tiền Phạt (F4)</h3>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handleConfirmPayFine}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '14px', fontSize: '13px' }}>
                  <div>Lý do: <strong>{selectedFine.reason}</strong></div>
                  <div>Số tiền còn nợ: <strong style={{ color: 'var(--color-danger)' }}>{formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))}</strong></div>
                </div>

                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Số tiền thu đợt này (VNĐ)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phương thức thanh toán</label>
                  <select
                    className="form-control"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                  >
                    <option value="Tiền mặt">💵 Tiền mặt tại quầy</option>
                    <option value="Chuyển khoản VietQR">🏦 Chuyển khoản VietQR</option>
                    <option value="Thẻ ATM / POS">💳 Quẹt máy POS</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowPayModal(false)} disabled={payingFine}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={payingFine}>
                  {payingFine ? 'Đang thu...' : '✓ Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
