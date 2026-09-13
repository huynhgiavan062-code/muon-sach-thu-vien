/**
 * Date and time formatters for Vietnam timezone (Asia/Ho_Chi_Minh)
 */

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    // If it's a date string like "2026-09-13 14:37:26", parse properly
    const sanitized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) {
      // Fallback: if format is YYYY-MM-DD HH:mm:ss, can split manually
      const parts = dateStr.split(/[\sT]+/);
      if (parts.length >= 2) {
        const [y, m, day] = parts[0].split('-');
        return `${day}/${m}/${y} ${parts[1].slice(0, 8)}`;
      }
      return String(dateStr);
    }

    // Format using Vietnamese locale in Asia/Ho_Chi_Minh
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    return formatter.format(d);
  } catch (e) {
    return String(dateStr);
  }
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const sanitized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(/[\sT]+/);
      if (parts[0].includes('-')) {
        const [y, m, day] = parts[0].split('-');
        return `${day}/${m}/${y}`;
      }
      return String(dateStr);
    }
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(d);
  } catch (e) {
    return String(dateStr);
  }
}

export function formatTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const sanitized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
    const d = new Date(sanitized);
    if (isNaN(d.getTime())) {
      const parts = dateStr.split(/[\sT]+/);
      return parts[1] ? parts[1].slice(0, 8) : String(dateStr);
    }
    return new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(d);
  } catch (e) {
    return String(dateStr);
  }
}
