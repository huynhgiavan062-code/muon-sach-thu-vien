const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đường dẫn thư mục uploads/covers
const coversDir = path.join(__dirname, '..', 'uploads', 'covers');

// Đảm bảo thư mục lưu trữ tồn tại
if (!fs.existsSync(coversDir)) {
  fs.mkdirSync(coversDir, { recursive: true });
}

// Cấu hình lưu trữ file
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(coversDir)) {
      fs.mkdirSync(coversDir, { recursive: true });
    }
    cb(null, coversDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `cover-${safeName}-${uniqueSuffix}${ext}`);
  }
});

// Kiểm tra định dạng file
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) && allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file hình ảnh định dạng JPG, JPEG, PNG, WEBP hoặc GIF.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  }
});

// Middleware bọc để bắt lỗi thân thiện từ Multer
const uploadCoverMiddleware = (req, res, next) => {
  const singleUpload = upload.single('cover');

  singleUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Kích thước file ảnh không được vượt quá 5MB.' });
        }
        return res.status(400).json({ error: `Lỗi tải ảnh: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Lỗi khi tải ảnh bìa.' });
    }
    next();
  });
};

module.exports = {
  uploadCoverMiddleware,
  coversDir
};
