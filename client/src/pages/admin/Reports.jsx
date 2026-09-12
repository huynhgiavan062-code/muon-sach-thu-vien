import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../../api/dashboardApi';

export default function Reports() {
  const [reportType, setReportType] = useState('overdue');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await dashboardApi.getReports(reportType);
      setReport(res);
    } catch (err) {
      setError(err.message || 'Lỗi khi tải báo cáo.');
    } finally {
      setLoading(false);
    }
  }, [reportType]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportCSV = () => {
    if (!report || !report.data || report.data.length === 0) return;

    const headers = Object.keys(report.data[0]);
    const rows = report.data.map(row =>
      headers.map(field => {
        let val = row[field] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    );

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatVND = (num) => {
    return Number(num || 0).toLocaleString('vi-VN') + ' đ';
  };

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Báo Cáo Nghiệp Vụ Thư Viện</h1>
          <p className="page-subtitle">Tổng hợp số liệu kiểm kê, danh sách vi phạm quá hạn và theo dõi công nợ</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={handleExportCSV} disabled={!report || report.data?.length === 0}>
            📥 Xuất CSV (Excel)
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()} disabled={!report}>
            🖨 In báo cáo
          </button>
        </div>
      </div>

      {/* Report Selector Tabs */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Chọn loại báo cáo:</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              className={`btn btn-sm ${reportType === 'overdue' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setReportType('overdue')}
            >
              ⚠️ Sách quá hạn chưa trả
            </button>
            <button
              className={`btn btn-sm ${reportType === 'fines_debt' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setReportType('fines_debt')}
            >
              💰 Công nợ tiền phạt độc giả
            </button>
            <button
              className={`btn btn-sm ${reportType === 'inventory' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setReportType('inventory')}
            >
              📦 Kiểm kê & Tồn kho sách
            </button>
            <button
              className={`btn btn-sm ${reportType === 'top_borrowed' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setReportType('top_borrowed')}
            >
              🔥 Sách mượn nhiều nhất
            </button>
          </div>
        </div>
      </div>

      {/* Report Content Card */}
      <div className="card" id="printable-report">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--border-color)' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--color-primary)' }}>
              {report?.title || 'Đang tải báo cáo...'}
            </h2>
            {report && (
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Thời điểm lập: {new Date(report.generatedAt).toLocaleString('vi-VN')} • Tổng số dòng: <strong>{report.totalRecords}</strong>
              </span>
            )}
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '50px 0' }}>
              <div className="spinner spinner-lg"></div>
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)' }}>Đang xuất dữ liệu báo cáo...</p>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-danger)' }}>
              <p>{error}</p>
              <button className="btn btn-primary btn-sm" onClick={fetchReport}>Tải lại</button>
            </div>
          ) : !report || report.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px' }}>
              <span style={{ fontSize: '40px', display: 'block', marginBottom: '8px' }}>📄</span>
              <p style={{ fontSize: '15px', fontWeight: 500 }}>Không có bản ghi nào trong báo cáo này</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  {reportType === 'overdue' && (
                    <tr>
                      <th>Mã phiếu</th>
                      <th>Độc giả</th>
                      <th>Liên hệ</th>
                      <th>Tên sách</th>
                      <th>Hạn trả</th>
                      <th style={{ textAlign: 'right', color: 'var(--color-danger)' }}>Quá hạn</th>
                    </tr>
                  )}

                  {reportType === 'fines_debt' && (
                    <tr>
                      <th>Số phiếu phạt</th>
                      <th>Độc giả</th>
                      <th>Lý do phạt</th>
                      <th style={{ textAlign: 'right' }}>Mức phạt</th>
                      <th style={{ textAlign: 'right' }}>Đã nộp</th>
                      <th style={{ textAlign: 'right', color: 'var(--color-danger)' }}>Còn nợ</th>
                      <th>Ngày lập</th>
                    </tr>
                  )}

                  {reportType === 'inventory' && (
                    <tr>
                      <th>Mã sách</th>
                      <th>Tựa sách / ISBN</th>
                      <th>Thể loại</th>
                      <th>Vị trí kệ</th>
                      <th style={{ textAlign: 'right' }}>Tổng kho</th>
                      <th style={{ textAlign: 'right' }}>Có sẵn</th>
                      <th style={{ textAlign: 'right' }}>Đang mượn</th>
                    </tr>
                  )}

                  {reportType === 'top_borrowed' && (
                    <tr>
                      <th>Mã sách</th>
                      <th>Tên sách</th>
                      <th>Tác giả</th>
                      <th>Thể loại</th>
                      <th style={{ textAlign: 'right' }}>Tổng bản</th>
                      <th style={{ textAlign: 'right', color: 'var(--color-primary)' }}>Lượt mượn</th>
                    </tr>
                  )}
                </thead>

                <tbody>
                  {reportType === 'overdue' && report.data.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.borrow_code}</td>
                      <td>
                        <strong>{r.reader_name}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{r.reader_code}</div>
                      </td>
                      <td style={{ fontSize: '12px' }}>{r.phone || r.email}</td>
                      <td>{r.book_title}</td>
                      <td style={{ fontSize: '12px' }}>{r.due_date}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-danger)' }}>
                        {r.overdue_days} ngày
                      </td>
                    </tr>
                  ))}

                  {reportType === 'fines_debt' && report.data.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>FP-{String(r.fine_id).padStart(5, '0')}</td>
                      <td>
                        <strong>{r.reader_name}</strong> ({r.reader_code})
                      </td>
                      <td>{r.reason}</td>
                      <td style={{ textAlign: 'right' }}>{formatVND(r.amount)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success, #10b981)' }}>{formatVND(r.paid_amount)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
                        {formatVND(r.remaining_debt)}
                      </td>
                      <td style={{ fontSize: '12px' }}>{r.created_at?.split('T')[0] || r.created_at}</td>
                    </tr>
                  ))}

                  {reportType === 'inventory' && report.data.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.book_code}</td>
                      <td>
                        <strong>{r.title}</strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ISBN: {r.isbn || 'N/A'}</div>
                      </td>
                      <td>{r.category_name}</td>
                      <td>{r.shelf_code} ({r.shelf_location})</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.total_quantity}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-success, #10b981)' }}>{r.available_quantity}</td>
                      <td style={{ textAlign: 'right', color: 'var(--color-primary)' }}>{r.borrowed_quantity}</td>
                    </tr>
                  ))}

                  {reportType === 'top_borrowed' && report.data.map((r, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{r.book_code}</td>
                      <td><strong>{r.title}</strong></td>
                      <td>{r.author_name || 'N/A'}</td>
                      <td>{r.category_name}</td>
                      <td style={{ textAlign: 'right' }}>{r.total_quantity}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-primary)', fontSize: '14px' }}>
                        {r.borrow_times} lượt
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
