const crypto = require('crypto');

const JWT_ALGORITHM = 'HS256';
const MIN_PRODUCTION_SECRET_LENGTH = 32;

const KNOWN_WEAK_SECRETS = new Set([
  'fallback_secret_key_for_development_only',
  'secret',
  'jwt_secret',
  'your_jwt_secret',
  'changeme',
  'change_me',
  'development',
  'dev_secret',
  '123456',
  'password',
]);

let ephemeralDevSecret = null;
let warnedEphemeral = false;

function isWeakSecret(secret) {
  const lower = String(secret || '').trim().toLowerCase();
  return !lower || KNOWN_WEAK_SECRETS.has(lower);
}

/**
 * Lấy JWT_SECRET an toàn (không bao giờ dùng chuỗi hardcode đoán được).
 * - Ở NODE_ENV=production: bắt buộc có JWT_SECRET mạnh (>= 32 ký tự, không nằm trong danh sách yếu), fail-fast nếu thiếu.
 * - Ở dev/test: ưu tiên process.env.JWT_SECRET; nếu chưa cấu hình thì tự sinh khóa ngẫu nhiên theo tiến trình (ephemeral).
 */
function getJwtSecret() {
  const envSecret = typeof process.env.JWT_SECRET === 'string'
    ? process.env.JWT_SECRET.trim()
    : '';
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!envSecret) {
      throw new Error(
        '[SECURITY FATAL] Biến môi trường JWT_SECRET là bắt buộc khi chạy ở NODE_ENV=production.'
      );
    }
    if (envSecret.length < MIN_PRODUCTION_SECRET_LENGTH) {
      throw new Error(
        `[SECURITY FATAL] JWT_SECRET ở môi trường production phải có tối thiểu ${MIN_PRODUCTION_SECRET_LENGTH} ký tự.`
      );
    }
    if (isWeakSecret(envSecret)) {
      throw new Error(
        '[SECURITY FATAL] JWT_SECRET đang dùng chuỗi mặc định/yếu không được phép ở môi trường production.'
      );
    }
    return envSecret;
  }

  if (envSecret) {
    return envSecret;
  }

  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(48).toString('hex');
    if (!warnedEphemeral && process.env.NODE_ENV !== 'test') {
      warnedEphemeral = true;
      console.warn(
        '[SECURITY WARN] Chưa cấu hình JWT_SECRET trong .env — đang dùng khóa ngẫu nhiên tạm thời cho phiên chạy dev hiện tại.'
      );
    }
  }

  return ephemeralDevSecret;
}

function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '8h';
}

function assertJwtConfig() {
  return getJwtSecret();
}

function _resetEphemeralSecretForTest() {
  ephemeralDevSecret = null;
  warnedEphemeral = false;
}

module.exports = {
  JWT_ALGORITHM,
  MIN_PRODUCTION_SECRET_LENGTH,
  getJwtSecret,
  getJwtExpiresIn,
  assertJwtConfig,
  _resetEphemeralSecretForTest,
};
