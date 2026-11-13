const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class RefreshAccessToken {
  constructor(userRepository, refreshTokenRepository) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
  }

  async execute(input) {
    const refresh_token =
      typeof input === 'string'
        ? input
        : input?.refresh_token || input?.refreshToken;

    if (!refresh_token) {
      const error = new Error('Refresh token là bắt buộc');
      error.statusCode = 400;
      error.code = 'MISSING_REFRESH_TOKEN';
      throw error;
    }

    const tokenRecord =
      await this.refreshTokenRepository.findByToken(refresh_token);

    if (!tokenRecord) {
      const error = new Error('Refresh token không hợp lệ');
      error.statusCode = 401;
      error.code = 'INVALID_REFRESH_TOKEN';
      throw error;
    }

    if (tokenRecord.revoked_at) {
      const error = new Error('Refresh token đã bị thu hồi');
      error.statusCode = 401;
      error.code = 'REVOKED_REFRESH_TOKEN';
      throw error;
    }

    if (new Date() > new Date(tokenRecord.expires_at)) {
      const error = new Error('Refresh token đã hết hạn');
      error.statusCode = 401;
      error.code = 'EXPIRED_REFRESH_TOKEN';
      throw error;
    }

    const user = await this.userRepository.findById(tokenRecord.user_id);

    if (!user || !user.is_active) {
      const error = new Error(
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa',
      );
      error.statusCode = 403;
      error.code = 'USER_INACTIVE';
      throw error;
    }

    const revokeFn =
      this.refreshTokenRepository.revokeToken ||
      this.refreshTokenRepository.revoke;
    if (revokeFn) {
      await revokeFn.call(this.refreshTokenRepository, refresh_token);
    }

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const createFn =
      this.refreshTokenRepository.createToken ||
      this.refreshTokenRepository.create;
    if (createFn) {
      await createFn.call(
        this.refreshTokenRepository,
        user.user_id,
        newRefreshToken,
        expiresAt,
      );
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

    const accessToken = jwt.sign(payload, secret, { expiresIn });

    return {
      token: accessToken,
      access_token: accessToken,
      refreshToken: newRefreshToken,
      refresh_token: newRefreshToken,
      token_type: 'Bearer',
      expires_in: 28800,
    };
  }
}

module.exports = RefreshAccessToken;
