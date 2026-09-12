const express = require('express');
const router = express.Router();
const { dbAll, dbGet, dbRun, dbTransaction } = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');

function generateReceiptCode() {
  const year = new Date().getFullYear();
  const prefix = `PN-${year}-`;
  const last = dbGet("SELECT receipt_code FROM import_receipts WHERE receipt_code LIKE ? ORDER BY id DESC LIMIT 1", [`${prefix}%`]);

  if (!last || !last.receipt_code) {
    return `${prefix}0001`;
  }
  const match = last.receipt_code.match(new RegExp(`^PN-${year}-(\\d+)$`));
  if (!match) {
    return `${prefix}${Date.now().toString().slice(-4)}`;
  }
  const nextNum = parseInt(match[1], 10) + 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

// GET /api/imports - List import receipts (Admin only)
router.get('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;

    const where = [];
    const params = [];

    if (search && search.trim()) {
      const s = `%${search.trim()}%`;
      where.push('(ir.receipt_code LIKE ? OR ir.supplier LIKE ? OR ir.invoice_number LIKE ?)');
      params.push(s, s, s);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as count FROM import_receipts ir ${whereClause}`;
    const totalRow = dbGet(countSql, params);
    const total = totalRow ? totalRow.count : 0;

    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const receipts = dbAll(`
      SELECT 
        ir.*,
        u.full_name as admin_name,
        COUNT(id_detail.id) as total_items,
        COALESCE(SUM(id_detail.quantity), 0) as total_units
      FROM import_receipts ir
      LEFT JOIN users u ON ir.admin_id = u.id
      LEFT JOIN import_details id_detail ON ir.id = id_detail.import_receipt_id
      ${whereClause}
      GROUP BY ir.id
      ORDER BY ir.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    res.json({
      data: receipts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1
      }
    });
  } catch (err) {
    console.error('Error getting import receipts:', err);
    res.status(500).json({ error: 'Lỗi khi tải danh sách phiếu nhập sách.' });
  }
});

// GET /api/imports/:id - Single receipt details
router.get('/:id', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const receiptId = parseInt(req.params.id, 10);
    const receipt = dbGet(`
      SELECT 
        ir.*,
        u.full_name as admin_name
      FROM import_receipts ir
      LEFT JOIN users u ON ir.admin_id = u.id
      WHERE ir.id = ?
    `, [receiptId]);

    if (!receipt) {
      return res.status(404).json({ error: 'Không tìm thấy phiếu nhập.' });
    }

    const items = dbAll(`
      SELECT 
        id_detail.*,
        b.book_code, b.title, b.isbn,
        c.name as category_name
      FROM import_details id_detail
      JOIN books b ON id_detail.book_id = b.id
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE id_detail.import_receipt_id = ?
    `, [receiptId]);

    res.json({ receipt, items });
  } catch (err) {
    console.error('Error getting receipt detail:', err);
    res.status(500).json({ error: 'Lỗi khi tải chi tiết phiếu nhập.' });
  }
});

// POST /api/imports - Create import receipt and update inventory (Admin only)
router.post('/', authMiddleware, authorize('admin'), (req, res) => {
  try {
    const { supplier, invoice_number, import_date, notes, items } = req.body;

    if (!supplier || !supplier.trim()) {
      return res.status(400).json({ error: 'Vui lòng nhập tên nhà cung cấp.' });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Vui lòng thêm ít nhất một đầu sách vào phiếu nhập.' });
    }

    const receiptCode = generateReceiptCode();
    const dateStr = import_date || new Date().toISOString().split('T')[0];

    const result = dbTransaction(tx => {
      let totalAmount = 0;

      for (const item of items) {
        const qty = Number(item.quantity);
        const price = Number(item.unit_price) || 0;
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Số lượng nhập của mỗi cuốn sách phải lớn hơn 0.');
        }
        totalAmount += qty * price;
      }

      // Insert receipt
      const resReceipt = tx.dbRun(`
        INSERT INTO import_receipts (
          receipt_code, supplier, import_date, invoice_number, total_amount, admin_id, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        receiptCode,
        supplier.trim(),
        dateStr,
        invoice_number ? invoice_number.trim() : null,
        totalAmount,
        req.user.id,
        notes ? notes.trim() : null
      ]);

      const receiptId = resReceipt.lastInsertRowid;

      // Insert details and increase books inventory
      for (const item of items) {
        const bookId = Number(item.book_id);
        const qty = Number(item.quantity);
        const price = Number(item.unit_price) || 0;

        tx.dbRun(`
          INSERT INTO import_details (import_receipt_id, book_id, quantity, unit_price)
          VALUES (?, ?, ?, ?)
        `, [receiptId, bookId, qty, price]);

        tx.dbRun(`
          UPDATE books 
          SET 
            total_quantity = total_quantity + ?,
            available_quantity = available_quantity + ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [qty, qty, bookId]);
      }

      return {
        id: receiptId,
        receipt_code: receiptCode,
        total_amount: totalAmount,
        items_count: items.length
      };
    });

    res.status(201).json({
      message: `Tạo phiếu nhập sách ${result.receipt_code} thành công. Đã cập nhật kho lưu trữ.`,
      receipt: result
    });
  } catch (err) {
    console.error('Error creating import receipt:', err);
    res.status(400).json({ error: err.message || 'Lỗi khi lập phiếu nhập sách.' });
  }
});

module.exports = router;
