const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ApiError = require('../../../utils/api-error');
const HttpStatus = require('../../../utils/http-status');

const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Map chặt chẽ MIME type -> danh sách phần mở rộng hợp lệ (chống giả mạo MIME / đổi đuôi .html, .svg, .exe)
const ALLOWED_MIME_TO_EXTENSIONS = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

const ALLOWED_MIME_TYPES = new Set(Object.keys(ALLOWED_MIME_TO_EXTENSIONS));

// Chỉ cho phép xem trực tiếp (inline) với PDF và ảnh raster an toàn; Office luôn tải về (attachment)
const SAFE_INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

function isAllowedUploadFile(mimetype, originalname) {
  const allowedExts = ALLOWED_MIME_TO_EXTENSIONS[mimetype];
  if (!allowedExts) return false;
  const ext = path.extname(String(originalname || '')).toLowerCase();
  return allowedExts.includes(ext);
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').slice(0, 12).toLowerCase();
    const safeExt = /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
    const uniqueName = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!isAllowedUploadFile(file.mimetype, file.originalname)) {
    return cb(
      new ApiError(
        HttpStatus.BAD_REQUEST,
        'Định dạng hoặc phần mở rộng tệp không hợp lệ (chỉ nhận PDF, PNG, JPG, WEBP, DOC/DOCX, XLS/XLSX khớp MIME)',
        'file'
      )
    );
  }
  cb(null, true);
};

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
  },
});

module.exports = {
  uploadMiddleware,
  UPLOAD_DIR,
  MAX_FILE_SIZE_BYTES,
  ALLOWED_MIME_TYPES,
  ALLOWED_MIME_TO_EXTENSIONS,
  SAFE_INLINE_MIME_TYPES,
  isAllowedUploadFile,
};
