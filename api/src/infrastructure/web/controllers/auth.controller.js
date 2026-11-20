const jwt = require('jsonwebtoken');
const { z } = require('zod');
const HttpStatus = require('../../../utils/http-status');
const { getJwtSecret, JWT_ALGORITHM } = require('../../../config/jwt');
const AuthenticateUser = require('../../../use_cases/AuthenticateUser');
const GetMeProfile = require('../../../use_cases/GetMeProfile');
const RefreshAccessToken = require('../../../use_cases/RefreshAccessToken');
const ChangePassword = require('../../../use_cases/users/ChangePassword');
const PostgresUserRepository = require('../../database/PostgresUserRepository');
const PostgresTokenRepository = require('../../database/PostgresTokenRepository');
const PostgresAuditLogRepository = require('../../database/PostgresAuditLogRepository');

const userRepository = new PostgresUserRepository();
const tokenRepository = new PostgresTokenRepository();
const auditLogRepository = new PostgresAuditLogRepository();

const authenticateUserUseCase = new AuthenticateUser(
  userRepository,
  tokenRepository
);
const getMeProfileUseCase = new GetMeProfile(userRepository);
const refreshAccessTokenUseCase = new RefreshAccessToken(
  userRepository,
  tokenRepository
);
const changePasswordUseCase = new ChangePassword({
  userRepository,
  auditLogRepository,
});

const ACCESS_COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function getCookieSecurityOptions(req) {
  const isSecureRequest =
    process.env.COOKIE_SECURE === 'true' ||
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https';
  return {
    httpOnly: true,
    secure: isSecureRequest,
    sameSite: isSecureRequest ? 'strict' : 'lax',
  };
}

function setAuthCookies(req, res, { token, refreshToken }) {
  const base = getCookieSecurityOptions(req);
  if (token) {
    res.cookie('token', token, { ...base, maxAge: ACCESS_COOKIE_MAX_AGE_MS });
  }
  if (refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      ...base,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}

function clearAuthCookies(res) {
  res.clearCookie('token');
  res.clearCookie('refreshToken');
}

const loginSchema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const changePasswordSchema = z.object({
  old_password: z.string().min(1, 'Vui lòng nhập mật khẩu cũ'),
  new_password: z.string().min(6, 'Mật khẩu mới tối thiểu 6 ký tự'),
});

class AuthController {
  async login(req, res, next) {
    try {
      const validatedData = loginSchema.parse(req.body);
      const result = await authenticateUserUseCase.execute(validatedData);

      setAuthCookies(req, res, result);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  }

  /**
   * Kiểm tra phiên đăng nhập an toàn (không trả 401 khi ở chế độ Prototype / chưa đăng nhập)
   * và tự động xoay vòng refreshToken nếu access token hết hạn.
   */
  async session(req, res) {
    const respondGuest = (shouldClearCookies = false) => {
      if (shouldClearCookies) clearAuthCookies(res);
      return res.status(HttpStatus.OK).json({
        success: true,
        data: { authenticated: false, user: null },
        errors: [],
        timestamp: new Date().toISOString(),
      });
    };

    try {
      const authHeader = req.headers.authorization;
      const accessToken =
        authHeader && authHeader.startsWith('Bearer ')
          ? authHeader.split(' ')[1]
          : req.cookies?.token || null;
      const secret = getJwtSecret();

      if (accessToken) {
        try {
          const decoded = jwt.verify(accessToken, secret, {
            algorithms: [JWT_ALGORITHM],
          });
          const profile = await getMeProfileUseCase.execute(
            decoded.sub || decoded.user_id
          );
          return res.status(HttpStatus.OK).json({
            success: true,
            data: { authenticated: true, user: profile },
            errors: [],
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Access token hết hạn hoặc không hợp lệ -> thử refreshToken bên dưới
        }
      }

      const refreshToken = req.cookies?.refreshToken || null;
      if (refreshToken) {
        try {
          const refreshed = await refreshAccessTokenUseCase.execute(refreshToken);
          const decodedRefreshed = jwt.verify(refreshed.token, secret, {
            algorithms: [JWT_ALGORITHM],
          });
          const profile = await getMeProfileUseCase.execute(
            decodedRefreshed.sub || decodedRefreshed.user_id
          );
          setAuthCookies(req, res, refreshed);
          return res.status(HttpStatus.OK).json({
            success: true,
            data: { authenticated: true, user: profile },
            errors: [],
            timestamp: new Date().toISOString(),
          });
        } catch {
          return respondGuest(true);
        }
      }

      return respondGuest(Boolean(req.cookies?.token));
    } catch {
      return respondGuest(false);
    }
  }

  async getMe(req, res, next) {
    try {
      const userId = req.user.user_id || req.user.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          data: null,
          errors: [{ message: 'Chưa xác thực danh tính' }],
          timestamp: new Date().toISOString(),
        });
      }

      const result = await getMeProfileUseCase.execute(userId);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: result,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const refreshToken =
        (req.body && req.body.refreshToken) ||
        (req.cookies && req.cookies.refreshToken);
      if (refreshToken) {
        await tokenRepository.revokeToken(refreshToken);
      }
      clearAuthCookies(res);

      return res.status(HttpStatus.OK).json({
        success: true,
        data: null,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }

  async refresh(req, res, next) {
    try {
      const refreshToken =
        (req.body && req.body.refreshToken) ||
        (req.cookies && req.cookies.refreshToken);
      if (!refreshToken) {
        clearAuthCookies(res);

        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          data: null,
          errors: [
            {
              field: 'auth',
              code: 'MISSING_REFRESH_TOKEN',
              message: 'Thiếu refreshToken',
            },
          ],
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await refreshAccessTokenUseCase.execute(refreshToken);
        setAuthCookies(req, res, result);

        return res.status(HttpStatus.OK).json({
          success: true,
          data: result,
          errors: [],
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        clearAuthCookies(res);
        throw err;
      }
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const userId = req.user.user_id || req.user.id;
      if (!userId) {
        return res.status(HttpStatus.UNAUTHORIZED).json({
          success: false,
          data: null,
          errors: [{ message: 'Chưa xác thực danh tính' }],
          timestamp: new Date().toISOString(),
        });
      }

      const validatedData = changePasswordSchema.parse(req.body);

      await changePasswordUseCase.execute({
        user_id: userId,
        old_password: validatedData.old_password,
        new_password: validatedData.new_password,
      });

      return res.status(HttpStatus.OK).json({
        success: true,
        data: null,
        errors: [],
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: error.issues.map((err) => ({
            field: err.path.join('.'),
            message: err.message,
          })),
          timestamp: new Date().toISOString(),
        });
      }
      next(error);
    }
  }
}

module.exports = new AuthController();
