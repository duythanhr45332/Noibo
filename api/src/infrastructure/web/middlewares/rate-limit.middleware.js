const HttpStatus = require('../../../utils/http-status');

const MAX_TRACKED_KEYS = 10000;
const CLEANUP_INTERVAL_MS = 60 * 1000;

const allStores = [];

function normalizeIp(req) {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return String(raw).replace(/^::ffff:/, '');
}

function normalizeUsername(req) {
  const u = req.body?.username;
  if (typeof u !== 'string') return '';
  return u.trim().toLowerCase().slice(0, 100);
}

function formatWaitMinutes(retryAfterSec) {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `${mins} phút`;
}

/**
 * Tạo middleware Rate Limiter theo cửa sổ cố định (Fixed Window) có hỗ trợ:
 * - countOnlyFailed: chỉ đếm khi response status >= 400 (dùng cho login / change-password)
 * - resetOnSuccess: khi response status < 400 thì xóa luôn bộ đếm của key đó
 * - Chuẩn header RateLimit-* và Retry-After + format lỗi JSON chuẩn ERP-AM
 */
function createRateLimiter({
  windowMs,
  max,
  keyGenerator,
  countOnlyFailed = false,
  resetOnSuccess = false,
  field = 'auth',
  messageBuilder,
  skip,
}) {
  const store = new Map();
  allStores.push(store);

  const cleanup = () => {
    const now = Date.now();
    for (const [k, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(k);
      }
    }
  };

  const timer = setInterval(cleanup, CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === 'function') {
    timer.unref();
  }

  const getOrCreateEntry = (key, now) => {
    const existing = store.get(key);
    if (existing && existing.resetAt > now) {
      return existing;
    }
    if (store.size >= MAX_TRACKED_KEYS) {
      cleanup();
      if (store.size >= MAX_TRACKED_KEYS) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) store.delete(oldestKey);
      }
    }
    const fresh = { count: 0, resetAt: now + windowMs };
    store.set(key, fresh);
    return fresh;
  };

  const middleware = (req, res, next) => {
    if (process.env.RATE_LIMIT_DISABLED === 'true') {
      return next();
    }
    if (typeof skip === 'function' && skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    if (!key) {
      return next();
    }

    const now = Date.now();
    const existing = store.get(key);
    const activeEntry = existing && existing.resetAt > now ? existing : null;
    const currentCount = activeEntry ? activeEntry.count : 0;

    if (currentCount >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((activeEntry.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(Math.ceil(activeEntry.resetAt / 1000)));

      const message =
        typeof messageBuilder === 'function'
          ? messageBuilder(retryAfterSec)
          : `Quá nhiều yêu cầu. Vui lòng thử lại sau ${formatWaitMinutes(retryAfterSec)}.`;

      return res.status(HttpStatus.TOO_MANY_REQUESTS || 429).json({
        success: false,
        data: null,
        errors: [
          {
            field,
            code: 'TOO_MANY_REQUESTS',
            message,
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    if (!countOnlyFailed) {
      const entry = getOrCreateEntry(key, now);
      entry.count += 1;
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
      res.setHeader('RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
      return next();
    }

    // countOnlyFailed: kiểm tra status code sau khi controller xử lý xong
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - currentCount)));

    res.on('finish', () => {
      if (res.statusCode >= 400 && res.statusCode !== 429) {
        const entry = getOrCreateEntry(key, Date.now());
        entry.count += 1;
      } else if (resetOnSuccess && res.statusCode >= 200 && res.statusCode < 300) {
        store.delete(key);
      }
    });

    return next();
  };

  middleware._store = store;
  return middleware;
}

const LOGIN_WINDOW_MS = Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000; // 15 phút
const LOGIN_ACCOUNT_MAX = Number(process.env.RATE_LIMIT_LOGIN_MAX) || 5; // 5 lần sai / IP+username
const LOGIN_IP_MAX = Number(process.env.RATE_LIMIT_LOGIN_IP_MAX) || 30; // 30 lần sai / IP (chống quét nhiều account)

// Lớp 1: Chống dò mật khẩu 1 tài khoản (không khóa oan đồng nghiệp chung IP văn phòng)
const loginAccountLimiter = createRateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_ACCOUNT_MAX,
  countOnlyFailed: true,
  resetOnSuccess: true,
  field: 'auth',
  keyGenerator: (req) => {
    const ip = normalizeIp(req);
    const username = normalizeUsername(req);
    return username ? `login:acct:${ip}:${username}` : `login:acct:${ip}:__empty__`;
  },
  messageBuilder: (retrySec) =>
    `Bạn đã nhập sai thông tin đăng nhập quá ${LOGIN_ACCOUNT_MAX} lần. Tài khoản tạm khóa đăng nhập từ thiết bị này trong ${formatWaitMinutes(retrySec)}.`,
});

// Lớp 2: Chống credential stuffing / quét hàng loạt username từ cùng 1 IP
const loginIpLimiter = createRateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_IP_MAX,
  countOnlyFailed: true,
  resetOnSuccess: false,
  field: 'auth',
  keyGenerator: (req) => `login:ip:${normalizeIp(req)}`,
  messageBuilder: (retrySec) =>
    `Phát hiện quá nhiều lượt đăng nhập thất bại từ địa chỉ mạng này. Vui lòng thử lại sau ${formatWaitMinutes(retrySec)}.`,
});

// Kết hợp cả 2 lớp cho POST /api/v1/auth/login
const loginRateLimiter = [loginIpLimiter, loginAccountLimiter];

// Chống dò mật khẩu cũ ở PUT /api/v1/auth/change-password
const changePasswordRateLimiter = createRateLimiter({
  windowMs: LOGIN_WINDOW_MS,
  max: 5,
  countOnlyFailed: true,
  resetOnSuccess: true,
  field: 'old_password',
  keyGenerator: (req) => `chpwd:${req.user?.user_id || normalizeIp(req)}`,
  messageBuilder: (retrySec) =>
    `Bạn đã nhập sai mật khẩu cũ quá nhiều lần. Vui lòng thử lại sau ${formatWaitMinutes(retrySec)}.`,
});

// Chống spam / brute-force POST /api/v1/auth/refresh
const refreshRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_REFRESH_MAX) || 30,
  countOnlyFailed: false,
  field: 'auth',
  keyGenerator: (req) => `refresh:${normalizeIp(req)}`,
  messageBuilder: (retrySec) =>
    `Quá nhiều yêu cầu làm mới phiên đăng nhập. Vui lòng thử lại sau ${formatWaitMinutes(retrySec)}.`,
});

// Giới hạn tốc độ tổng cho toàn bộ /api/v1 (chống flood / DoS nhẹ)
const apiGeneralRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 phút
  max: Number(process.env.RATE_LIMIT_API_MAX) || 300,
  countOnlyFailed: false,
  field: 'rate_limit',
  keyGenerator: (req) => `api:${normalizeIp(req)}`,
  skip: (req) => req.path === '/health',
  messageBuilder: () =>
    'Hệ thống nhận quá nhiều yêu cầu trong thời gian ngắn. Vui lòng thử lại sau ít giây.',
});

function resetAllLimiters() {
  for (const store of allStores) {
    store.clear();
  }
}

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  loginAccountLimiter,
  loginIpLimiter,
  changePasswordRateLimiter,
  refreshRateLimiter,
  apiGeneralRateLimiter,
  resetAllLimiters,
};
