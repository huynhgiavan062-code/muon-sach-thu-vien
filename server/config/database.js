const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'data', 'library.db');
let db = null;
let dbReady = null;

function ensureDataDir() {
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

async function getDb() {
  if (db) return db;
  if (dbReady) return dbReady;

  dbReady = (async () => {
    ensureDataDir();
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    return db;
  })();

  db = await dbReady;
  return db;
}

function saveDb() {
  if (db) {
    ensureDataDir();
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Helper to run queries that return data
function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper to get single row
function dbGet(sql, params = []) {
  const results = dbAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper to run insert/update/delete
function dbRun(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const rowidRes = db.exec('SELECT last_insert_rowid()');
  const lastInsertRowid = (rowidRes && rowidRes[0] && rowidRes[0].values[0]) ? rowidRes[0].values[0][0] : null;
  saveDb();
  return {
    changes,
    lastInsertRowid
  };
}

// Transaction wrapper with rollback on error
function dbTransaction(callback) {
  db.run('BEGIN TRANSACTION');
  try {
    const txRunner = {
      dbAll,
      dbGet,
      dbRun: (sql, params = []) => {
        db.run(sql, params);
        const changes = db.getRowsModified();
        const rowidRes = db.exec('SELECT last_insert_rowid()');
        const lastInsertRowid = (rowidRes && rowidRes[0] && rowidRes[0].values[0]) ? rowidRes[0].values[0][0] : null;
        return { changes, lastInsertRowid };
      }
    };
    const result = callback(txRunner);
    db.run('COMMIT');
    saveDb();
    return result;
  } catch (err) {
    db.run('ROLLBACK');
    throw err;
  }
}

async function initializeDatabase() {
  await getDb();

  // ==================== USERS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin', 'user')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'locked', 'suspended')),
      reader_code TEXT UNIQUE,
      avatar TEXT,
      address TEXT,
      date_of_birth TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== CATEGORIES ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== AUTHORS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      biography TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== PUBLISHERS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS publishers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== SHELVES ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS shelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ==================== BOOKS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      isbn TEXT,
      author_id INTEGER,
      category_id INTEGER,
      publisher_id INTEGER,
      shelf_id INTEGER,
      publish_year INTEGER,
      language TEXT DEFAULT 'Tiếng Việt',
      description TEXT,
      cover_image TEXT,
      total_quantity INTEGER NOT NULL DEFAULT 0,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES authors(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (publisher_id) REFERENCES publishers(id),
      FOREIGN KEY (shelf_id) REFERENCES shelves(id)
    )
  `);

  // ==================== BORROW RECORDS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrow_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      admin_id INTEGER,
      borrow_date DATE NOT NULL,
      due_date DATE NOT NULL,
      return_date DATE,
      borrowed_at DATETIME,
      returned_at DATETIME,
      status TEXT NOT NULL DEFAULT 'borrowing' CHECK(status IN ('borrowing', 'returned', 'overdue')),
      renewal_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);

  // ==================== BORROW DETAILS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrow_record_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      returned_quantity INTEGER NOT NULL DEFAULT 0,
      condition_note TEXT,
      FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  // ==================== BORROW REQUESTS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS borrow_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      requested_at DATETIME NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'cancelled')),
      processed_at DATETIME,
      processed_by INTEGER,
      rejection_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (processed_by) REFERENCES users(id)
    )
  `);

  // ==================== RESERVATIONS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      reservation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'ready', 'fulfilled', 'cancelled', 'expired')),
      queue_position INTEGER,
      expiry_date DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  // ==================== FINES ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS fines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      borrow_record_id INTEGER,
      user_id INTEGER NOT NULL,
      book_id INTEGER,
      reason TEXT NOT NULL,
      overdue_days INTEGER DEFAULT 0,
      amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'partial')),
      paid_date DATETIME,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  // Migration: Ensure borrow_record_id can be null
  try {
    const tableInfo = dbAll("PRAGMA table_info(fines)");
    const brCol = tableInfo.find(c => c.name === 'borrow_record_id');
    if (brCol && brCol.notnull === 1) {
      db.run('PRAGMA foreign_keys = OFF');
      db.run(`
        CREATE TABLE fines_temp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          borrow_record_id INTEGER,
          user_id INTEGER NOT NULL,
          book_id INTEGER,
          reason TEXT NOT NULL,
          overdue_days INTEGER DEFAULT 0,
          amount REAL NOT NULL DEFAULT 0,
          paid_amount REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid', 'paid', 'partial')),
          paid_date DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (borrow_record_id) REFERENCES borrow_records(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (book_id) REFERENCES books(id)
        )
      `);
      db.run('INSERT INTO fines_temp SELECT * FROM fines');
      db.run('DROP TABLE fines');
      db.run('ALTER TABLE fines_temp RENAME TO fines');
      db.run('PRAGMA foreign_keys = ON');
    }
  } catch (migErr) {
    console.warn('Migration warning for fines table:', migErr);
  }

  // Migration: Add borrowed_at, returned_at to borrow_records if not exist
  try {
    const brTableInfo = dbAll("PRAGMA table_info(borrow_records)");
    const hasBorrowedAt = brTableInfo.some(c => c.name === 'borrowed_at');
    const hasReturnedAt = brTableInfo.some(c => c.name === 'returned_at');

    if (!hasBorrowedAt) {
      db.run('ALTER TABLE borrow_records ADD COLUMN borrowed_at DATETIME');
      db.run("UPDATE borrow_records SET borrowed_at = COALESCE(created_at, borrow_date || ' 08:00:00') WHERE borrowed_at IS NULL");
    }
    if (!hasReturnedAt) {
      db.run('ALTER TABLE borrow_records ADD COLUMN returned_at DATETIME');
      db.run("UPDATE borrow_records SET returned_at = (return_date || ' 17:00:00') WHERE returned_at IS NULL AND return_date IS NOT NULL");
    }
  } catch (migErr) {
    console.warn('Migration warning for borrow_records table:', migErr);
  }

  // ==================== IMPORT RECEIPTS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS import_receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_code TEXT UNIQUE NOT NULL,
      supplier TEXT NOT NULL,
      import_date DATE NOT NULL,
      invoice_number TEXT,
      total_amount REAL DEFAULT 0,
      admin_id INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_id) REFERENCES users(id)
    )
  `);

  // ==================== IMPORT DETAILS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS import_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      import_receipt_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price REAL DEFAULT 0,
      FOREIGN KEY (import_receipt_id) REFERENCES import_receipts(id),
      FOREIGN KEY (book_id) REFERENCES books(id)
    )
  `);

  // ==================== NOTIFICATIONS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'info' CHECK(type IN ('info', 'warning', 'success', 'error')),
      is_read INTEGER DEFAULT 0,
      link TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // ==================== SYSTEM SETTINGS ====================
  db.run(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT
    )
  `);

  // ==================== SEED DATA ====================
  seedData();
  saveDb();
}

function seedData() {
  const userCount = dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount && userCount.count > 0) return;

  console.log('Seeding database...');

  // ----- Admin account -----
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT INTO users (username, email, password_hash, full_name, phone, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['admin', 'admin@library.edu.vn', adminHash, 'Quản trị viên', '0901234567', 'admin', 'active']);

  // ----- User accounts -----
  const userHash = bcrypt.hashSync('user123', 10);
  db.run(`INSERT INTO users (username, email, password_hash, full_name, phone, role, status, reader_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user1', 'nguyenvana@student.edu.vn', userHash, 'Nguyễn Văn A', '0912345678', 'user', 'active', 'DG-001']);

  db.run(`INSERT INTO users (username, email, password_hash, full_name, phone, role, status, reader_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['user2', 'tranthib@student.edu.vn', userHash, 'Trần Thị B', '0923456789', 'user', 'active', 'DG-002']);

  // ----- Categories -----
  const categories = [
    ['Công nghệ thông tin', 'Sách về lập trình, phần mềm, hệ thống'],
    ['Kinh tế', 'Sách về kinh tế, tài chính, quản trị'],
    ['Khoa học tự nhiên', 'Sách về toán, lý, hóa, sinh'],
    ['Văn học', 'Tiểu thuyết, truyện ngắn, thơ'],
    ['Ngoại ngữ', 'Sách học tiếng Anh, Nhật, Trung, Hàn'],
    ['Kỹ thuật', 'Sách về cơ khí, điện, điện tử, xây dựng'],
    ['Y học', 'Sách về y khoa, dược, điều dưỡng'],
    ['Luật', 'Sách về pháp luật, luật kinh tế']
  ];
  for (const [name, desc] of categories) {
    db.run('INSERT INTO categories (name, description) VALUES (?, ?)', [name, desc]);
  }

  // ----- Authors -----
  const authors = [
    ['Robert C. Martin', 'Tác giả của Clean Code, nổi tiếng trong lĩnh vực phần mềm'],
    ['Martin Fowler', 'Chuyên gia về kiến trúc phần mềm'],
    ['Nguyễn Nhật Ánh', 'Nhà văn Việt Nam nổi tiếng'],
    ['Dale Carnegie', 'Tác giả sách phát triển bản thân'],
    ['Thomas H. Cormen', 'Đồng tác giả Introduction to Algorithms'],
    ['Andrew S. Tanenbaum', 'Tác giả sách hệ điều hành và mạng máy tính'],
    ['Joshua Bloch', 'Tác giả Effective Java'],
    ['Eric Evans', 'Tác giả Domain-Driven Design']
  ];
  for (const [name, bio] of authors) {
    db.run('INSERT INTO authors (name, biography) VALUES (?, ?)', [name, bio]);
  }

  // ----- Publishers -----
  const publishers = [
    ['NXB Đại học Quốc gia', 'TP. Hồ Chí Minh', '028-1234567', 'nxb@vnu.edu.vn'],
    ['NXB Giáo dục', 'Hà Nội', '024-7654321', 'nxb@giaoduc.edu.vn'],
    ['Prentice Hall', null, null, null],
    ["O'Reilly Media", null, null, null],
    ['Addison-Wesley', null, null, null],
    ['NXB Trẻ', 'TP. Hồ Chí Minh', '028-9876543', 'nxb@nxbtre.com.vn']
  ];
  for (const [name, addr, phone, email] of publishers) {
    db.run('INSERT INTO publishers (name, address, phone, email) VALUES (?, ?, ?, ?)', [name, addr, phone, email]);
  }

  // ----- Shelves -----
  const shelves = [
    ['A-01', 'Kệ CNTT 1', 'Tầng 2, Khu A'],
    ['A-02', 'Kệ CNTT 2', 'Tầng 2, Khu A'],
    ['A-03', 'Kệ CNTT 3', 'Tầng 2, Khu A'],
    ['B-01', 'Kệ Kinh tế 1', 'Tầng 3, Khu B'],
    ['B-02', 'Kệ Kinh tế 2', 'Tầng 3, Khu B'],
    ['C-01', 'Kệ Khoa học', 'Tầng 4, Khu C'],
    ['D-01', 'Kệ Văn học', 'Tầng 1, Khu D'],
    ['E-01', 'Kệ Ngoại ngữ', 'Tầng 1, Khu E']
  ];
  for (const [code, name, loc] of shelves) {
    db.run('INSERT INTO shelves (code, name, location) VALUES (?, ?, ?)', [code, name, loc]);
  }

  // ----- Books -----
  const books = [
    ['BK-001', 'Clean Code', '978-0132350884', 1, 1, 3, 1, 2008, 'English', 'A Handbook of Agile Software Craftsmanship', 5, 3],
    ['BK-002', 'Refactoring', '978-0134757599', 2, 1, 5, 1, 2018, 'English', 'Improving the Design of Existing Code', 3, 2],
    ['BK-003', 'Mắt biếc', '978-604-1-12345-6', 3, 4, 6, 7, 2019, 'Tiếng Việt', 'Tiểu thuyết nổi tiếng của Nguyễn Nhật Ánh', 4, 4],
    ['BK-004', 'Đắc Nhân Tâm', '978-604-1-67890-1', 4, 2, 6, 4, 2016, 'Tiếng Việt', 'How to Win Friends and Influence People - Bản dịch', 6, 5],
    ['BK-005', 'Introduction to Algorithms', '978-0262033848', 5, 1, 3, 2, 2009, 'English', 'The comprehensive textbook on algorithms', 3, 1],
    ['BK-006', 'Computer Networks', '978-0132126953', 6, 1, 3, 2, 2010, 'English', 'Mạng máy tính - giáo trình kinh điển', 4, 3],
    ['BK-007', 'Effective Java', '978-0134685991', 7, 1, 5, 3, 2018, 'English', 'Best practices for Java programming', 3, 2],
    ['BK-008', 'Domain-Driven Design', '978-0321125217', 8, 1, 5, 3, 2003, 'English', 'Tackling Complexity in the Heart of Software', 2, 1],
    ['BK-009', 'Tôi thấy hoa vàng trên cỏ xanh', '978-604-1-11111-1', 3, 4, 6, 7, 2010, 'Tiếng Việt', 'Truyện dài của Nguyễn Nhật Ánh', 5, 5],
    ['BK-010', 'Kinh tế học vi mô', '978-604-2-22222-2', 4, 2, 1, 4, 2020, 'Tiếng Việt', 'Giáo trình kinh tế học vi mô cơ bản', 8, 6]
  ];
  for (const b of books) {
    db.run(`INSERT INTO books (book_code, title, isbn, author_id, category_id, publisher_id, shelf_id, publish_year, language, description, total_quantity, available_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, b);
  }

  // ----- System Settings -----
  const settings = [
    ['max_borrow_books', '5', 'Số sách tối đa được mượn cùng lúc'],
    ['borrow_duration_days', '14', 'Số ngày mượn sách mặc định'],
    ['fine_per_day', '5000', 'Tiền phạt mỗi ngày quá hạn (VND)'],
    ['max_renewals', '2', 'Số lần gia hạn tối đa'],
    ['renewal_days', '7', 'Số ngày gia hạn mỗi lần'],
    ['reservation_expiry_days', '3', 'Số ngày giữ sách đặt trước']
  ];
  for (const [key, val, desc] of settings) {
    db.run('INSERT INTO system_settings (key, value, description) VALUES (?, ?, ?)', [key, val, desc]);
  }

  console.log('✓ Database seeded successfully');
}

module.exports = { getDb, initializeDatabase, dbAll, dbGet, dbRun, dbTransaction, saveDb };
