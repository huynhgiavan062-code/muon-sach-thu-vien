import { useState, useEffect, useCallback } from 'react';
import { importApi } from '../../api/importApi';
import { bookApi } from '../../api/bookApi';
import { useToast } from '../../contexts/ToastContext';

export default function ImportManagement() {
  const toast = useToast();

  const [receipts, setReceipts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [receiptItems, setReceiptItems] = useState([]);

  // Book list for selector
  const [availableBooks, setAvailableBooks] = useState([]);

  // Create form state
  const [newReceipt, setNewReceipt] = useState({
    supplier: '',
    invoice_number: '',
    import_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [{ book_id: '', quantity: 1, unit_price: 50000 }]
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchReceipts = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await importApi.getImports({ page, limit: 10, search });
      setReceipts(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Lỗi khi tải danh sách phiếu nhập.');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchReceipts(1);
  }, [fetchReceipts]);

  const loadBooks = async () => {
    try {
      const res = await bookApi.getBooks({ limit: 200 });
      setAvailableBooks(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCreateModal = () => {
    loadBooks();
    setNewReceipt({
      supplier: '',
      invoice_number: '',
      import_date: new Date().toISOString().split('T')[0],
      notes: '',
      items: [{ book_id: '', quantity: 1, unit_price: 50000 }]
    });
    setShowCreateModal(true);
  };

  const handleAddItemRow = () => {
    setNewReceipt(prev => ({
      ...prev,
      items: [...prev.items, { book_id: '', quantity: 1, unit_price: 50000 }]
    }));
  };

  const handleRemoveItemRow = (idx) => {
    if (newReceipt.items.length <= 1) return;
    setNewReceipt(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx)
    }));
  };

  const handleItemChange = (idx, field, value) => {
    setNewReceipt(prev => {
      const nextItems = [...prev.items];
      nextItems[idx] = { ...nextItems[idx], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const handleCreateReceipt = async (e) => {
    e.preventDefault();
    if (!newReceipt.supplier.trim()) {
      toast.error('Vui lòng nhập tên nhà cung cấp.');
      return;
    }

    for (const it of newReceipt.items) {
      if (!it.book_id) {
        toast.error('Vui lòng chọn sách cho tất cả các dòng.');
        return;
      }
      if (Number(it.quantity) <= 0) {
        toast.error('Số lượng nhập phải lớn hơn 0.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await importApi.createImport(newReceipt);
      toast.success(res.message || 'Lập phiếu nhập thành công.');
      setShowCreateModal(false);
      fetchReceipts(1);
    } catch (err) {
      toast.error(err.message || 'Lỗi khi tạo phiếu nhập.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = async (id) => {
    try {
      const res = await importApi.getImportDetail(id);
      setSelectedReceipt(res.receipt);
      setReceiptItems(res.items || []);
      setShowDetailModal(true);
    } catch (err) {
      toast.error('Lỗi khi tải chi tiết phiếu nhập.');
    }
  };

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const calculateTotal = () => {
    return newReceipt.items.reduce((acc, curr) => {
      return acc + (Number(curr.quantity) || 0) * (Number(curr.unit_price) || 0);
    }, 0);
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Quản Lý Nhập Sách</h1>
          <p className="page-subtitle">Theo dõi nhập kho tài liệu, hóa đơn nhà xuất bản và bổ sung số lượng tồn kho tự động</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <span>＋</span> Lập phiếu nhập sách mới
        </button>
      </div>

      {/* Main Table Card */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Lịch Sử Phiếu Nhập Sách</h2>
          <div style={{ width: '280px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Tìm theo mã phiếu, nhà cung cấp, hóa đơn..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner spinner-lg"></div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang tải danh sách phiếu nhập...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={() => fetchReceipts(1)}>Tải lại</button>
            </div>
          ) : receipts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '8px' }}>📥</span>
              <p style={{ fontSize: '16px', fontWeight: 500 }}>Chưa có phiếu nhập sách nào</p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Bấm nút "Lập phiếu nhập sách mới" để bắt đầu bổ sung ấn phẩm vào thư viện.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Nhà cung cấp / Đối tác</th>
                    <th>Số hóa đơn</th>
                    <th>Ngày nhập</th>
                    <th style={{ textAlign: 'center' }}>Số đầu sách</th>
                    <th style={{ textAlign: 'center' }}>Tổng số bản</th>
                    <th style={{ textAlign: 'right' }}>Tổng trị giá</th>
                    <th>Người tiếp nhận</th>
                    <th style={{ textAlign: 'center' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.receipt_code}</td>
                      <td>
                        <strong>{r.supplier}</strong>
                        {r.notes && <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.notes}</div>}
                      </td>
                      <td style={{ fontSize: '13px' }}>{r.invoice_number || '---'}</td>
                      <td style={{ fontSize: '12px' }}>{r.import_date}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-info">{r.total_items} đầu sách</span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{r.total_units} bản</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-success, #10b981)' }}>
                        {formatVND(r.total_amount)}
                      </td>
                      <td style={{ fontSize: '12px' }}>{r.admin_name || 'Thủ thư'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => handleOpenDetail(r.id)}
                          style={{ padding: '4px 10px', fontSize: '12px' }}
                        >
                          📄 Chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Trang {pagination.page} / {pagination.totalPages} (Tổng {pagination.total} phiếu)
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => fetchReceipts(pagination.page - 1)}
              >
                Trước
              </button>
              <button
                className="btn btn-outline btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchReceipts(pagination.page + 1)}
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal: Lập phiếu nhập sách mới */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" style={{ maxWidth: '680px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Lập Phiếu Nhập Sách Mới</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReceipt}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600 }}>
                      Nhà cung cấp / NXB <span style={{ color: 'var(--color-danger)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: NXB Giáo dục Việt Nam, Tiki, FAHASA..."
                      value={newReceipt.supplier}
                      onChange={(e) => setNewReceipt({ ...newReceipt, supplier: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Số hóa đơn / Chứng từ</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="VD: HD-2026-9812"
                      value={newReceipt.invoice_number}
                      onChange={(e) => setNewReceipt({ ...newReceipt, invoice_number: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Ngày nhập kho</label>
                    <input
                      type="date"
                      className="form-control"
                      value={newReceipt.import_date}
                      onChange={(e) => setNewReceipt({ ...newReceipt, import_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Ghi chú bổ sung</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Lô sách tài trợ, bổ sung học kỳ..."
                      value={newReceipt.notes}
                      onChange={(e) => setNewReceipt({ ...newReceipt, notes: e.target.value })}
                    />
                  </div>
                </div>

                {/* Items Section */}
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>Danh sách ấn phẩm nhập kho:</span>
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAddItemRow} style={{ fontSize: '11px' }}>
                      ＋ Thêm đầu sách
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {newReceipt.items.map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 100px 140px 36px',
                          gap: '8px',
                          alignItems: 'center',
                          background: 'var(--bg-secondary)',
                          padding: '8px',
                          borderRadius: '6px'
                        }}
                      >
                        <select
                          className="form-control"
                          value={item.book_id}
                          onChange={(e) => handleItemChange(idx, 'book_id', e.target.value)}
                          required
                        >
                          <option value="">-- Chọn tài liệu --</option>
                          {availableBooks.map((b) => (
                            <option key={b.id} value={b.id}>
                              [{b.book_code}] {b.title} (Hiện có: {b.total_quantity})
                            </option>
                          ))}
                        </select>

                        <input
                          type="number"
                          className="form-control"
                          placeholder="Số bản"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          required
                        />

                        <input
                          type="number"
                          className="form-control"
                          placeholder="Đơn giá (đ)"
                          min="0"
                          step="1000"
                          value={item.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                        />

                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          disabled={newReceipt.items.length <= 1}
                          onClick={() => handleRemoveItemRow(idx)}
                          style={{ padding: '6px', color: 'var(--color-danger)' }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>

                  <div style={{ textAlign: 'right', marginTop: '12px', fontSize: '14px' }}>
                    <span>Tổng giá trị phiếu nhập: </span>
                    <strong style={{ fontSize: '16px', color: 'var(--color-success, #10b981)' }}>
                      {formatVND(calculateTotal())}
                    </strong>
                  </div>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)} disabled={submitting}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Đang lưu...' : '✓ Xác nhận nhập kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chi tiết phiếu nhập */}
      {showDetailModal && selectedReceipt && (
        <div className="modal-backdrop" onClick={() => setShowDetailModal(false)}>
          <div className="modal-container" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Chi Tiết Phiếu Nhập #{selectedReceipt.receipt_code}</h3>
              <button className="modal-close" onClick={() => setShowDetailModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px', fontSize: '13px' }}>
                <div>Nhà cung cấp: <strong>{selectedReceipt.supplier}</strong></div>
                <div>Số hóa đơn: <strong>{selectedReceipt.invoice_number || 'N/A'}</strong></div>
                <div>Ngày nhập: <strong>{selectedReceipt.import_date}</strong></div>
                <div>Thủ thư tiếp nhận: <strong>{selectedReceipt.admin_name}</strong></div>
              </div>

              <div className="table-responsive">
                <table className="table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>Mã & Tên sách</th>
                      <th style={{ textAlign: 'center' }}>Số lượng</th>
                      <th style={{ textAlign: 'right' }}>Đơn giá</th>
                      <th style={{ textAlign: 'right' }}>Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptItems.map((it, idx) => (
                      <tr key={idx}>
                        <td>
                          <strong>{it.title}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{it.book_code}</div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{it.quantity}</td>
                        <td style={{ textAlign: 'right' }}>{formatVND(it.unit_price)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatVND(it.quantity * it.unit_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan="3" style={{ textAlign: 'right' }}>Tổng cộng:</th>
                      <th style={{ textAlign: 'right', color: 'var(--color-success, #10b981)', fontSize: '15px' }}>
                        {formatVND(selectedReceipt.total_amount)}
                      </th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-outline" onClick={() => window.print()}>
                🖨 In phiếu nhập
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowDetailModal(false)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
