import { useState, useEffect, useCallback } from 'react';
import { fineApi } from '../../api/fineApi';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function UserFines() {
  const { user } = useAuth();
  const toast = useToast();

  const [fines, setFines] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_paid: 0, total_unpaid: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusTab, setStatusTab] = useState(''); // '' | 'unpaid' | 'paid'

  // Payment modal
  const [selectedFine, setSelectedFine] = useState(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState('Chuyển khoản');
  const [transactionCode, setTransactionCode] = useState('');
  const [paying, setPaying] = useState(false);

  const fetchFines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fineApi.getMyFines({ status: statusTab });
      setFines(res.data || []);
      setSummary(res.summary || { total_amount: 0, total_paid: 0, total_unpaid: 0 });
    } catch (err) {
      setError(err.message || 'Không thể tải thông tin tiền phạt.');
    } finally {
      setLoading(false);
    }
  }, [statusTab]);

  useEffect(() => {
    fetchFines();
  }, [fetchFines]);

  const handleOpenPayModal = (fine) => {
    setSelectedFine(fine);
    setTransactionCode('');
    setPayMethod('Chuyển khoản');
    setShowPayModal(true);
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    if (!selectedFine) return;

    const remaining = selectedFine.amount - (selectedFine.paid_amount || 0);
    setPaying(true);
    try {
      const res = await fineApi.payFine(selectedFine.id, {
        amount: remaining,
        payment_method: payMethod,
        notes: `Độc giả thanh toán trực tuyến: Mã GD/Ghi chú: ${transactionCode || 'Chuyển khoản ngân hàng'}`
      });
      toast.success(res.message || 'Thanh toán tiền phạt thành công!');
      setShowPayModal(false);
      fetchFines();
    } catch (err) {
      toast.error(err.message || 'Lỗi khi thanh toán tiền phạt.');
    } finally {
      setPaying(false);
    }
  };

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid':
        return <span className="badge badge-success">✓ Đã thanh toán</span>;
      case 'partial':
        return <span className="badge badge-warning">⚡ Nộp một phần</span>;
      case 'unpaid':
      default:
        return <span className="badge badge-danger">✕ Chưa thanh toán</span>;
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Khoản Phạt Của Tôi</h1>
        <p className="page-subtitle">Theo dõi các khoản tiền phạt do quá hạn, hỏng sách và hướng dẫn thanh toán</p>
      </div>

      {/* Debt Status Card */}
      <div style={{ marginBottom: '24px' }}>
        {summary.total_unpaid > 0 ? (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(245, 158, 11, 0.08) 100%)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '16px'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-danger, #ef4444)' }}>
                  Bạn đang có tiền phạt chưa thanh toán: {formatVND(summary.total_unpaid)}
                </h3>
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '640px' }}>
                {summary.total_unpaid >= 50000
                  ? 'Số tiền phạt vượt mức quy định (>= 50.000 đ). Tài khoản tạm thời bị khóa quyền mượn sách mới cho đến khi hoàn tất thanh toán.'
                  : 'Vui lòng hoàn tất nộp tiền phạt tại quầy lưu thông hoặc thanh toán online bên dưới để tránh ảnh hưởng đến quyền mượn sách.'}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Tổng phát sinh</span>
                <strong style={{ fontSize: '14px' }}>{formatVND(summary.total_amount)}</strong>
              </div>
              <div style={{ width: '1px', height: '30px', background: 'var(--border-color)' }}></div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)' }}>Đã thanh toán</span>
                <strong style={{ fontSize: '14px', color: 'var(--color-success, #10b981)' }}>{formatVND(summary.total_paid)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span style={{ fontSize: '24px' }}>🎉</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-success, #10b981)', fontSize: '15px' }}>
                Tài khoản thư viện không có nợ phạt!
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Bạn luôn trả sách đúng hạn. Thẻ thư viện của bạn hợp lệ và có thể tiếp tục mượn các tài liệu yêu thích.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main List Card */}
      <div className="card">
        {/* Tabs */}
        <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '24px' }}>
          <button
            onClick={() => setStatusTab('')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: statusTab === '' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: statusTab === '' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: statusTab === '' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Tất cả ({fines.length})
          </button>
          <button
            onClick={() => setStatusTab('unpaid')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: statusTab === 'unpaid' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: statusTab === 'unpaid' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: statusTab === 'unpaid' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Chưa thanh toán
          </button>
          <button
            onClick={() => setStatusTab('paid')}
            style={{
              padding: '14px 4px',
              border: 'none',
              background: 'none',
              borderBottom: statusTab === 'paid' ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: statusTab === 'paid' ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: statusTab === 'paid' ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Đã thanh toán
          </button>
        </div>

        {/* List Content */}
        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="spinner spinner-lg"></div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang tải thông tin tiền phạt...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={fetchFines} style={{ marginTop: '8px' }}>
                Thử lại
              </button>
            </div>
          ) : fines.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>📖</div>
              <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                Không có khoản phạt nào trong danh sách
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Bạn không có khoản nợ phạt nào ứng với bộ lọc đã chọn.
              </p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Lý do phạt</th>
                    <th>Phiếu mượn / Tài liệu</th>
                    <th style={{ textAlign: 'right' }}>Mức phạt</th>
                    <th style={{ textAlign: 'right' }}>Đã nộp</th>
                    <th style={{ textAlign: 'right' }}>Còn nợ</th>
                    <th style={{ textAlign: 'center' }}>Trạng thái</th>
                    <th>Ngày lập</th>
                    <th style={{ textAlign: 'center' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {fines.map((f) => {
                    const remaining = f.amount - (f.paid_amount || 0);
                    return (
                      <tr key={f.id}>
                        <td>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{f.reason}</div>
                          {f.overdue_days > 0 && (
                            <span style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                              Quá hạn {f.overdue_days} ngày
                            </span>
                          )}
                          {f.notes && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {f.notes}
                            </div>
                          )}
                        </td>

                        <td>
                          {f.borrow_code ? (
                            <div style={{ fontWeight: 500, color: 'var(--color-primary)' }}>
                              📋 {f.borrow_code}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Không có</span>
                          )}
                          {f.book_title && (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              📖 {f.book_title}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {formatVND(f.amount)}
                        </td>

                        <td style={{ textAlign: 'right', color: 'var(--color-success, #10b981)' }}>
                          {formatVND(f.paid_amount)}
                        </td>

                        <td style={{ textAlign: 'right', fontWeight: 600, color: remaining > 0 ? 'var(--color-danger, #ef4444)' : 'var(--text-secondary)' }}>
                          {formatVND(remaining)}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {getStatusBadge(f.status)}
                        </td>

                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {f.created_at ? new Date(f.created_at).toLocaleDateString('vi-VN') : '---'}
                          {f.paid_date && (
                            <div style={{ fontSize: '11px', color: 'var(--color-success, #10b981)' }}>
                              Đã thu: {new Date(f.paid_date).toLocaleDateString('vi-VN')}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: 'center' }}>
                          {f.status !== 'paid' ? (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenPayModal(f)}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              💳 Thanh toán
                            </button>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--color-success, #10b981)' }}>
                              ✓ Đã xong
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Thanh toán tiền phạt trực tuyến */}
      {showPayModal && selectedFine && (
        <div className="modal-backdrop" onClick={() => setShowPayModal(false)}>
          <div className="modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Thanh Toán Tiền Phạt Trực Tuyến</h3>
              <button className="modal-close" onClick={() => setShowPayModal(false)}>✕</button>
            </div>
            <form onSubmit={handleConfirmPayment}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-secondary)', padding: '14px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Lý do:</span>
                    <strong>{selectedFine.reason}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Số tiền cần thanh toán:</span>
                    <strong style={{ color: 'var(--color-danger, #ef4444)', fontSize: '16px' }}>
                      {formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))}
                    </strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600 }}>Phương thức thanh toán</label>
                  <select
                    className="form-control"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option value="Chuyển khoản QR code">🏦 Chuyển khoản VietQR / Ngân hàng</option>
                    <option value="Ví MoMo">📱 Ví điện tử MoMo</option>
                    <option value="Ví VNPAY">📱 Cổng thanh toán VNPAY</option>
                  </select>
                </div>

                {/* Bank QR info preview */}
                <div style={{ border: '1px dashed var(--border-color)', borderRadius: '8px', padding: '14px', textAlign: 'center', marginBottom: '16px', background: 'var(--bg-secondary)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    THÔNG TIN CHUYỂN KHOẢN
                  </div>
                  <div style={{ display: 'inline-block', padding: '10px', background: '#fff', borderRadius: '6px', marginBottom: '8px' }}>
                    {/* Visual QR mock */}
                    <div style={{ width: '120px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px' }}>
                      <span style={{ fontSize: '36px' }}>📱</span>
                      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>VIETQR SCAN</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', textAlign: 'left', lineHeight: '1.6' }}>
                    <div>Ngân hàng: <strong>BIDV - Chi nhánh Đại học</strong></div>
                    <div>Số tài khoản: <strong>1234567890</strong></div>
                    <div>Tên thụ hưởng: <strong>TRUONG DAI HOC - THU VIEN</strong></div>
                    <div>Số tiền: <strong style={{ color: 'var(--color-danger)' }}>{formatVND(selectedFine.amount - (selectedFine.paid_amount || 0))}</strong></div>
                    <div>Nội dung CK: <strong style={{ color: 'var(--color-primary)' }}>{user?.reader_code || 'DG'} PHAT {selectedFine.id}</strong></div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Mã giao dịch chuyển khoản (nếu có)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="VD: FT2348590123 hoặc Mã tham chiếu ngân hàng"
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>
                    Hệ thống sẽ cập nhật trạng thái thanh toán ngay khi bạn bấm xác nhận.
                  </span>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowPayModal(false)}
                  disabled={paying}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={paying}
                >
                  {paying ? 'Đang xử lý...' : '✓ Tôi đã chuyển khoản xong'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
