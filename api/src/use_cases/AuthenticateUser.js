const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class AuthenticateUser {
  constructor(userRepository, refreshTokenRepository = null) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async execute({ username, password }) {
    const user = await this.userRepository.findByUsername(username);

    if (!user) {
      const error = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    if (!user.is_active) {
      const error = new Error('Tài khoản đã bị vô hiệu hóa');
      error.statusCode = 403;
      error.code = 'USER_INACTIVE';
      throw error;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const error = new Error('Tên đăng nhập hoặc mật khẩu không chính xác');
      error.statusCode = 401;
      error.code = 'INVALID_CREDENTIALS';
      throw error;
    }

    const secret =
      process.env.JWT_SECRET || 'fallback_secret_key_for_development_only';
    const expiresIn = process.env.JWT_EXPIRES_IN || '8h';

    const payload = {
      sub: user.user_id,
      user_id: user.user_id,
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, secret, { expiresIn });

    let refreshToken = null;
    if (this.refreshTokenRepository) {
      const crypto = require('crypto');
      refreshToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      const createFn =
        this.refreshTokenRepository.createToken ||
        this.refreshTokenRepository.create;
      if (createFn) {
        await createFn.call(
          this.refreshTokenRepository,
          user.user_id,
          refreshToken,
          expiresAt,
        );
      }
    }

    return {
      token,
      access_token: token,
      refreshToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 28800,
      user: {
        id: user.user_id,
        user_id: user.user_id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    };
  }
}

module.exports = AuthenticateUser;
