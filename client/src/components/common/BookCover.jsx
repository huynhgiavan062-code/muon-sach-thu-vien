import { useState, useEffect } from 'react';
import './BookCover.css';

// Bảng màu gradient sang trọng dựa theo thể loại sách
const CATEGORY_GRADIENTS = {
  'công nghệ thông tin': 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
  'cntt': 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
  'kinh tế': 'linear-gradient(135deg, #064e3b 0%, #059669 50%, #10b981 100%)',
  'khoa học': 'linear-gradient(135deg, #3b0764 0%, #7c3aed 50%, #8b5cf6 100%)',
  'văn học': 'linear-gradient(135deg, #831843 0%, #db2777 50%, #f43f5e 100%)',
  'ngoại ngữ': 'linear-gradient(135deg, #164e63 0%, #0891b2 50%, #06b6d4 100%)',
  'kỹ thuật': 'linear-gradient(135deg, #1e293b 0%, #475569 50%, #64748b 100%)',
  'y học': 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #ef4444 100%)',
  'luật': 'linear-gradient(135deg, #713f12 0%, #d97706 50%, #f59e0b 100%)'
};

function getCategoryGradient(category) {
  if (!category) {
    return 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)';
  }
  const norm = category.toLowerCase().trim();
  for (const [key, grad] of Object.entries(CATEGORY_GRADIENTS)) {
    if (norm.includes(key)) return grad;
  }
  return 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)';
}

export default function BookCover({
  src,
  title = 'Sách Thư Viện',
  category = '',
  size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'responsive'
  className = '',
  style = {},
  aspectRatio = '3 / 4'
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset trạng thái khi src thay đổi
  useEffect(() => {
    setImgError(false);
    setImgLoaded(false);
  }, [src]);

  const hasValidImage = Boolean(src && src.trim() && !imgError);
  const bgGradient = getCategoryGradient(category);

  // Kích thước icon SVG theo size
  const iconSize = size === 'xs' ? 14 : size === 'sm' ? 18 : size === 'md' ? 24 : size === 'lg' ? 36 : 44;

  const containerClasses = [
    'book-cover-container',
    size !== 'responsive' ? `book-cover-${size}` : 'book-cover-responsive',
    className
  ].filter(Boolean).join(' ');

  const containerStyle = {
    ...(size === 'responsive' ? { aspectRatio } : {}),
    ...style
  };

  return (
    <div className={containerClasses} style={containerStyle} title={title}>
      {hasValidImage ? (
        <>
          {!imgLoaded && <div className="book-cover-shimmer" />}
          <img
            src={src}
            alt={title}
            loading="lazy"
            className={`book-cover-img ${imgLoaded ? 'loaded' : 'loading'}`}
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              setImgError(true);
              setImgLoaded(true);
            }}
          />
        </>
      ) : (
        /* Bìa mặc định sang trọng khi chưa có ảnh hoặc ảnh lỗi */
        <div
          className="book-cover-fallback"
          style={{ background: bgGradient }}
        >
          {category && size !== 'xs' && size !== 'sm' && (
            <div className="fallback-header">
              <span className="fallback-badge">{category}</span>
            </div>
          )}

          <div className="fallback-center">
            <svg
              className="fallback-icon"
              width={iconSize}
              height={iconSize}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              <line x1="9" y1="7" x2="16" y2="7" />
              <line x1="9" y1="11" x2="14" y2="11" />
            </svg>

            {size !== 'xs' && size !== 'sm' && (
              <div className="fallback-title">
                {title}
              </div>
            )}
          </div>

          {size !== 'xs' && size !== 'sm' && (
            <div className="fallback-footer">
              <span className="fallback-brand">THƯ VIỆN</span>
              <span>📚</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
