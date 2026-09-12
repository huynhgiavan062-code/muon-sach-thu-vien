const express = require('express');
const router = express.Router();
const { dbAll, dbGet } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

// GET /api/dashboard/admin - Admin Dashboard metrics & activities
router.get('/admin', authMiddleware, authorize('admin'), (req, res) => {
  try {
    // 1. KPI Counts
    const booksRow = dbGet(`
      SELECT 
        COUNT(*) as total_titles,
        COALESCE(SUM(total_quantity), 0) as total_copies,
        COALESCE(SUM(available_quantity), 0) as available_copies
      FROM books
    `) || { total_titles: 0, total_copies: 0, available_copies: 0 };

    const readersRow = dbGet("SELECT COUNT(*) as total_readers FROM users WHERE role = 'user'") || { total_readers: 0 };
    const borrowsActive = dbGet("SELECT COUNT(*) as active_borrows FROM borrow_records WHERE status IN ('borrowing', 'overdue')") || { active_borrows: 0 };
    const borrowsOverdue = dbGet("SELECT COUNT(*) as overdue_borrows FROM borrow_records WHERE status = 'overdue'") || { overdue_borrows: 0 };

    const finesRow = dbGet(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_fines,
        COALESCE(SUM(paid_amount), 0) as collected_fines,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN (amount - paid_amount) ELSE 0 END), 0) as debt_fines,
        COUNT(CASE WHEN status != 'paid' THEN 1 END) as unpaid_count
      FROM fines
    `) || { total_fines: 0, collected_fines: 0, debt_fines: 0, unpaid_count: 0 };

    const reservationsRow = dbGet(`
      SELECT 
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reservations,
        COUNT(CASE WHEN status = 'ready' THEN 1 END) as ready_reservations
      FROM reservations
    `) || { pending_reservations: 0, ready_reservations: 0 };

    // 2. Recent Borrows (latest 5)
    const recentBorrows = dbAll(`
      SELECT 
        br.id, br.borrow_code, br.borrow_date, br.due_date, br.status,
        u.full_name as reader_name, u.reader_code,
        (SELECT GROUP_CONCAT(b.title, ', ') 
         FROM borrow_details bd 
         JOIN books b ON bd.book_id = b.id 
         WHERE bd.borrow_record_id = br.id) as book_titles
      FROM borrow_records br
      JOIN users u ON br.user_id = u.id
      ORDER BY br.created_at DESC
      LIMIT 6
    `);

    // 3. Top Borrowed Books
    const topBooks = dbAll(`
      SELECT 
        b.id, b.book_code, b.title, b.cover_image,
        c.name as category_name,
        a.name as author_name,
        COUNT(bd.id) as borrow_count
      FROM borrow_details bd
      JOIN books b ON bd.book_id = b.id
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN authors a ON b.author_id = a.id
      GROUP BY b.id
      ORDER BY borrow_count DESC
      LIMIT 5
    `);

    // 4. Category breakdown (titles and copies)
    const categoryStats = dbAll(`
      SELECT 
        c.id, c.name,
        COUNT(b.id) as book_count,
        COALESCE(SUM(b.total_quantity), 0) as total_copies
      FROM categories c
      LEFT JOIN books b ON c.id = b.category_id
      GROUP BY c.id
      ORDER BY book_count DESC
    `);

    res.json({
      metrics: {
        total_books: booksRow.total_titles,
        total_copies: booksRow.total_copies,
        available_copies: booksRow.available_copies,
        borrowed_copies: booksRow.total_copies - booksRow.available_copies,
        total_readers: readersRow.total_readers,
        active_borrows: borrowsActive.active_borrows,
        overdue_borrows: borrowsOverdue.overdue_borrows,
        total_fines_amount: finesRow.total_fines,
        collected_fines_amount: finesRow.collected_fines,
        unpaid_fines_amount: finesRow.debt_fines,
        unpaid_fines_count: finesRow.unpaid_count,
        pending_reservations: reservationsRow.pending_reservations,
        ready_reservations: reservationsRow.ready_reservations
      },
      recentBorrows,
      topBooks,
      categoryStats
    });
  } catch (err) {
    console.error('Error getting admin dashboard data:', err);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu tổng quan quản trị.' });
  }
});

// GET /api/dashboard/user - User Dashboard metrics
router.get('/user', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    // Active borrows with items
    const activeBorrows = dbAll(`
      SELECT 
        br.id, br.borrow_code, br.borrow_date, br.due_date, br.status, br.renewal_count,
        (SELECT GROUP_CONCAT(b.title, ', ') 
         FROM borrow_details bd 
         JOIN books b ON bd.book_id = b.id 
         WHERE bd.borrow_record_id = br.id) as book_titles
      FROM borrow_records br
      WHERE br.user_id = ? AND br.status IN ('borrowing', 'overdue')
      ORDER BY br.due_date ASC
    `, [userId]);

    // Reservations
    const myReservations = dbAll(`
      SELECT 
        r.id, r.reservation_date, r.status, r.queue_position, r.expiry_date,
        b.title as book_title, b.book_code
      FROM reservations r
      JOIN books b ON r.book_id = b.id
      WHERE r.user_id = ? AND r.status IN ('pending', 'ready')
      ORDER BY r.created_at DESC
    `, [userId]);

    // Fines summary
    const finesRow = dbGet(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_fines,
        COALESCE(SUM(paid_amount), 0) as paid_fines,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN (amount - paid_amount) ELSE 0 END), 0) as unpaid_fines,
        COUNT(CASE WHEN status != 'paid' THEN 1 END) as unpaid_count
      FROM fines
      WHERE user_id = ?
    `, [userId]) || { total_fines: 0, paid_fines: 0, unpaid_fines: 0, unpaid_count: 0 };

    // Recent notifications
    const notifications = dbAll(`
      SELECT * 
      FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 4
    `, [userId]);

    // New arrivals / Recommended books
    const newArrivals = dbAll(`
      SELECT 
        b.id, b.book_code, b.title, b.cover_image, b.available_quantity,
        c.name as category_name, a.name as author_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      LEFT JOIN authors a ON b.author_id = a.id
      WHERE b.available_quantity > 0
      ORDER BY b.id DESC
      LIMIT 4
    `);

    res.json({
      metrics: {
        active_borrows_count: activeBorrows.length,
        reservations_count: myReservations.length,
        unpaid_fines: finesRow.unpaid_fines,
        unpaid_fines_count: finesRow.unpaid_count
      },
      activeBorrows,
      reservations: myReservations,
      notifications,
      newArrivals
    });
  } catch (err) {
    console.error('Error getting user dashboard data:', err);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu trang độc giả.' });
  }
});

// GET /api/dashboard/statistics - Comprehensive Library Statistics (Admin only)
router.get('/statistics', authMiddleware, authorize('admin'), (req, res) => {
  try {
    // 1. Reader Activity ranking
    const topReaders = dbAll(`
      SELECT 
        u.id, u.reader_code, u.full_name, u.email, u.phone,
        COUNT(br.id) as total_borrows,
        COUNT(CASE WHEN br.status IN ('borrowing', 'overdue') THEN 1 END) as currently_borrowing
      FROM users u
      LEFT JOIN borrow_records br ON u.id = br.user_id
      WHERE u.role = 'user'
      GROUP BY u.id
      ORDER BY total_borrows DESC
      LIMIT 8
    `);

    // 2. Status distribution of borrow records
    const borrowStatusDist = dbAll(`
      SELECT status, COUNT(*) as count 
      FROM borrow_records 
      GROUP BY status
    `);

    // 3. Books per shelf / location
    const shelfStats = dbAll(`
      SELECT 
        s.code, s.name, s.location,
        COUNT(b.id) as title_count,
        COALESCE(SUM(b.total_quantity), 0) as copy_count
      FROM shelves s
      LEFT JOIN books b ON s.id = b.shelf_id
      GROUP BY s.id
      ORDER BY copy_count DESC
    `);

    // 4. Financial totals
    const financial = dbGet(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(SUM(paid_amount), 0) as total_collected,
        COALESCE(SUM(CASE WHEN status != 'paid' THEN (amount - paid_amount) ELSE 0 END), 0) as total_debt
      FROM fines
    `) || { total_amount: 0, total_collected: 0, total_debt: 0 };

    res.json({
      topReaders,
      borrowStatusDist,
      shelfStats,
      financial
    });
  } catch (err) {
    console.error('Error getting statistics:', err);
    res.status(500).json({ error: 'Lỗi khi tải dữ liệu thống kê.' });
  }
});

// GET /api/dashboard/reports - Exportable reports (Admin only)
router.get('/reports', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { type = 'overdue' } = req.query;

    let reportData = [];
    let title = '';

    if (type === 'overdue') {
      title = 'Báo Cáo Sách Quá Hạn Chưa Hoàn Trả';
      reportData = dbAll(`
        SELECT 
          br.borrow_code, br.borrow_date, br.due_date,
          u.reader_code, u.full_name as reader_name, u.phone, u.email,
          b.book_code, b.title as book_title,
          ROUND((julianday('now') - julianday(br.due_date))) as overdue_days
        FROM borrow_records br
        JOIN users u ON br.user_id = u.id
        JOIN borrow_details bd ON br.id = bd.borrow_record_id
        JOIN books b ON bd.book_id = b.id
        WHERE br.status = 'overdue' OR (br.status = 'borrowing' AND br.due_date < DATE('now'))
        ORDER BY br.due_date ASC
      `);
    } else if (type === 'fines_debt') {
      title = 'Báo Cáo Công Nợ Tiền Phạt Độc Giả';
      reportData = dbAll(`
        SELECT 
          f.id as fine_id, f.reason, f.amount, f.paid_amount, (f.amount - f.paid_amount) as remaining_debt,
          f.created_at, f.status,
          u.reader_code, u.full_name as reader_name, u.phone, u.email,
          br.borrow_code
        FROM fines f
        JOIN users u ON f.user_id = u.id
        LEFT JOIN borrow_records br ON f.borrow_record_id = br.id
        WHERE f.status != 'paid'
        ORDER BY remaining_debt DESC
      `);
    } else if (type === 'inventory') {
      title = 'Báo Cáo Kiểm Kê & Tồn Kho Sách';
      reportData = dbAll(`
        SELECT 
          b.book_code, b.title, b.isbn, b.publish_year,
          c.name as category_name,
          a.name as author_name,
          s.code as shelf_code, s.location as shelf_location,
          b.total_quantity, b.available_quantity,
          (b.total_quantity - b.available_quantity) as borrowed_quantity
        FROM books b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN authors a ON b.author_id = a.id
        LEFT JOIN shelves s ON b.shelf_id = s.id
        ORDER BY b.book_code ASC
      `);
    } else if (type === 'top_borrowed') {
      title = 'Báo Cáo Sách Được Mượn Nhiều Nhất';
      reportData = dbAll(`
        SELECT 
          b.book_code, b.title, b.isbn,
          c.name as category_name,
          a.name as author_name,
          b.total_quantity, b.available_quantity,
          COUNT(bd.id) as borrow_times
        FROM borrow_details bd
        JOIN books b ON bd.book_id = b.id
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN authors a ON b.author_id = a.id
        GROUP BY b.id
        ORDER BY borrow_times DESC
      `);
    }

    res.json({
      type,
      title,
      generatedAt: new Date().toISOString(),
      totalRecords: reportData.length,
      data: reportData
    });
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ error: 'Lỗi khi xuất báo cáo.' });
  }
});

module.exports = router;
