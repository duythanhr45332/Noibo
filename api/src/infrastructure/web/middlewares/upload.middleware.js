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

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const safeExt = path.extname(file.originalname || '').slice(0, 12).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${safeExt}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    return cb(
      new ApiError(
        HttpStatus.BAD_REQUEST,
        'Định dạng file không được hỗ trợ (chỉ nhận PDF, PNG, JPG, WEBP, DOC/DOCX, XLS/XLSX)',
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
};
