const HttpStatus = require('../../../utils/http-status');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Usage: router.get('/users', authMiddleware, authorizeRoles('ADMIN', 'BOD'), ...)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(HttpStatus.UNAUTHORIZED).json({
        success: false,
        data: null,
        errors: [
          {
            field: 'auth',
            code: 'UNAUTHORIZED',
            message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(HttpStatus.FORBIDDEN).json({
        success: false,
        data: null,
        errors: [
          {
            field: 'auth',
            code: 'FORBIDDEN',
            message: 'Bạn không có quyền thực hiện thao tác này',
          },
        ],
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

module.exports = { authorizeRoles };
