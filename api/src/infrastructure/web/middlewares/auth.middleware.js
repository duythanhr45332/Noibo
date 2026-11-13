const jwt = require('jsonwebtoken');
const db = require('../../../config/database');
const logger = require('../../../utils/logger');

/**
 * Authentication Middleware
 * Verifies JWT and loads live user state from DB
 */
const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Không tìm thấy mã xác thực (Token missing)',
        },
      });
    }

    const secret =
      process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
    } catch (jwtErr) {
      if (jwtErr.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại',
          },
        });
      }
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Mã xác thực không hợp lệ',
        },
      });
    }

    const query = `
      SELECT user_id, username, full_name, role, is_active, deleted_at
      FROM users
      WHERE user_id = $1
    `;

    const result = await db.query(query, [decoded.sub || decoded.user_id]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: { code: 'USER_NOT_FOUND', message: 'Tài khoản không tồn tại' },
      });
    }

    const user = result.rows[0];

    if (!user.is_active || user.deleted_at !== null) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Tài khoản của bạn đã bị khóa hoặc vô hiệu hóa',
        },
      });
    }

    req.user = {
      sub: user.user_id,
      id: user.user_id,
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      role: user.role,
    };

    next();
  } catch (error) {
    logger.error('Auth Middleware Error:', error);
    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Lỗi hệ thống khi xác thực quyền truy cập',
      },
    });
  }
};

module.exports = authMiddleware;
