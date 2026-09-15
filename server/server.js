const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
const { initializeDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const bookRoutes = require('./routes/books');
const metadataRoutes = require('./routes/metadata');
const userRoutes = require('./routes/users');
const borrowRoutes = require('./routes/borrow');
const reservationRoutes = require('./routes/reservations');
const fineRoutes = require('./routes/fines');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const importRoutes = require('./routes/imports');
const settingsRoutes = require('./routes/settings');
const borrowRequestRoutes = require('./routes/borrowRequest');

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// CORS Configuration supporting Localhost and LAN access
const allowedStaticOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Vite server-side proxy)
    if (!origin) return callback(null, true);

    // Allow localhost or 127.0.0.1 on any port
    const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

    // Allow private LAN IPv4 addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) on any port
    const isPrivateLan = /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

    if (isLocalhost || isPrivateLan || allowedStaticOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error('CORS policy: Origin not allowed in LAN configuration'), false);
  },
  credentials: true
}));
app.use(express.json());
app.use(morgan('dev'));

// Static files
const coversDir = path.join(__dirname, 'uploads', 'covers');
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/metadata', metadataRoutes);
app.use('/api/users', userRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/borrow-requests', borrowRequestRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/fines', fineRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/imports', importRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
const healthCheckHandler = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint không tồn tại.' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Lỗi hệ thống. Vui lòng thử lại.' });
});

// Start server
async function start() {
  try {
    await initializeDatabase();
    console.log('✓ Database initialized');

    app.listen(PORT, HOST, () => {
      console.log(`✓ Server running on http://${HOST}:${PORT}`);
      console.log(`  Local:   http://localhost:${PORT}`);
      console.log(`  Network: http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
