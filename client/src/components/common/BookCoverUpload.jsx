import { useState, useRef } from 'react';
import BookCover from './BookCover';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

export default function BookCoverUpload({
  currentCover = '',
  selectedFile = null,
  previewUrl = '',
  onFileSelect,
  onRemove,
  bookTitle = 'Sách mới',
  category = ''
}) {
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef(null);

  // Kiểm tra file hợp lệ
  const validateAndSelect = (file) => {
    setValidationError('');

    if (!file) return;

    // Kiểm tra định dạng
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    const isMimeValid = ALLOWED_TYPES.includes(file.type);
    const isExtValid = ALLOWED_EXTS.includes(ext);

    if (!isMimeValid && !isExtValid) {
      setValidationError('Định dạng không hợp lệ. Chỉ chấp nhận file JPG, PNG, WEBP hoặc GIF.');
      return;
    }

    // Kiểm tra kích thước (tối đa 5MB)
    if (file.size > MAX_FILE_SIZE) {
      setValidationError('Dung lượng ảnh vượt quá giới hạn 5MB.');
      return;
    }

    onFileSelect(file);
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSelect(file);
    }
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onRemove();
  };

  const activePreview = previewUrl || currentCover;
  const formatBytes = (bytes) => {
    if (!bytes) return '';
    const mb = (bytes / (1024 * 1024)).toFixed(2);
    return `${mb} MB`;
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>
        Ảnh bìa sách
      </label>

      <div
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          background: 'var(--bg-secondary, #f8fafc)',
          border: `2px dashed ${dragOver ? 'var(--color-primary, #2563eb)' : 'var(--border-color, #cbd5e1)'}`,
          borderRadius: '10px',
          padding: '14px',
          transition: 'border-color 0.2s, background-color 0.2s',
          backgroundColor: dragOver ? 'rgba(37, 99, 235, 0.05)' : 'var(--bg-secondary, #f8fafc)'
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Khung hiển thị trước ảnh bìa */}
        <div style={{ flexShrink: 0 }}>
          <BookCover
            src={activePreview}
            title={bookTitle || 'Xem trước bìa'}
            category={category}
            size="md"
          />
        </div>

        {/* Khu vực hướng dẫn tải & thao tác */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".jpg,.jpeg,.png,.webp,.gif"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '6px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <span>📁</span> {activePreview ? 'Đổi ảnh bìa...' : 'Chọn file ảnh...'}
            </button>

            {activePreview && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleClear}
                style={{ color: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)', fontSize: '12px' }}
                title="Xóa ảnh bìa"
              >
                ✕ Xóa ảnh
              </button>
            )}
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-secondary, #64748b)', lineHeight: '1.4' }}>
            {selectedFile ? (
              <span style={{ color: 'var(--color-success, #10b981)', fontWeight: 500 }}>
                ✓ {selectedFile.name} ({formatBytes(selectedFile.size)})
              </span>
            ) : currentCover ? (
              <span>Đang sử dụng ảnh bìa hiện tại của sách.</span>
            ) : (
              <span>Kéo thả file ảnh vào đây hoặc bấm chọn file (JPG, PNG, WEBP, tối đa 5MB).</span>
            )}
          </div>

          {validationError && (
            <div style={{ color: 'var(--color-danger, #ef4444)', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
              ⚠ {validationError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
