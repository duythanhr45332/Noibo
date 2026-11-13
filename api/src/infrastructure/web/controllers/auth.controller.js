const HttpStatus = require('../../../utils/http-status');
const { z } = require('zod');
const AuthenticateUser = require('../../../use_cases/AuthenticateUser');
const GetMeProfile = require('../../../use_cases/GetMeProfile');
const RefreshAccessToken = require('../../../use_cases/RefreshAccessToken');
const ChangePassword = require('../../../use_cases/users/ChangePassword');
const PostgresUserRepository = require('../../database/PostgresUserRepository');
const PostgresTokenRepository = require('../../database/PostgresTokenRepository');

const userRepository = new PostgresUserRepository();
const tokenRepository = new PostgresTokenRepository();

const authenticateUserUseCase = new AuthenticateUser(
  userRepository,
  tokenRepository,
);
const getMeProfileUseCase = new GetMeProfile(userRepository);
const refreshAccessTokenUseCase = new RefreshAccessToken(
  userRepository,
  tokenRepository,
);
const changePasswordUseCase = new ChangePassword({ userRepository });

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

      const isSecureRequest =
        process.env.COOKIE_SECURE === 'true' ||
        req.secure ||
        req.headers['x-forwarded-proto'] === 'https';
      const cookieSameSite = isSecureRequest ? 'strict' : 'lax';

      res.cookie('token', result.token, {
        httpOnly: true,
        secure: isSecureRequest,
        sameSite: cookieSameSite,
        maxAge: 30 * 60 * 1000,
      });

      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: isSecureRequest,
        sameSite: cookieSameSite,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

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
      res.clearCookie('token');
      res.clearCookie('refreshToken');

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
        res.clearCookie('token');
        res.clearCookie('refreshToken');

        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          data: null,
          errors: [{ message: 'Thiếu refreshToken' }],
          timestamp: new Date().toISOString(),
        });
      }

      try {
        const result = await refreshAccessTokenUseCase.execute(refreshToken);

        const isSecureRequest =
          process.env.COOKIE_SECURE === 'true' ||
          req.secure ||
          req.headers['x-forwarded-proto'] === 'https';
        const cookieSameSite = isSecureRequest ? 'strict' : 'lax';

        res.cookie('token', result.token, {
          httpOnly: true,
          secure: isSecureRequest,
          sameSite: cookieSameSite,
          maxAge: 30 * 60 * 1000,
        });

        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: isSecureRequest,
          sameSite: cookieSameSite,
          maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return res.status(HttpStatus.OK).json({
          success: true,
          data: result,
          errors: [],
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        res.clearCookie('token');
        res.clearCookie('refreshToken');
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
