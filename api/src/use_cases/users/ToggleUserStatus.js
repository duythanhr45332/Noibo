const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES } = require('../../domain/constants/roles');

class ToggleUserStatus {
  constructor({ userRepository, auditLogRepository, logger }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(userId, { is_active, actorId = null }) {
    if (typeof is_active !== 'boolean') {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Trạng thái kích hoạt phải là boolean (true/false)',
        'is_active'
      );
    }

    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy người dùng', 'userId');
    }

    if (!is_active && actorId && String(actorId) === String(userId)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Không thể tự khóa tài khoản đang đăng nhập',
        'is_active'
      );
    }

    if (!is_active && existing.role === ROLES.ADMIN && existing.is_active) {
      const adminCount = await this.userRepository.countActiveByRole(ROLES.ADMIN);
      if (adminCount <= 1) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Không thể khóa tài khoản ADMIN hoạt động cuối cùng của hệ thống',
          'is_active'
        );
      }
    }

    const updated = await this.userRepository.updateStatus(userId, is_active);
    const safeUpdated = updated.toSafeObject ? updated.toSafeObject() : updated;

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'users',
          entity_id: userId,
          action: is_active ? 'ACTIVATE_USER' : 'LOCK_USER',
          old_values: { is_active: existing.is_active },
          new_values: { is_active: safeUpdated.is_active },
          changed_by: actorId,
        });
      } catch (auditErr) {
        if (this.logger) {
          this.logger.warn('Audit log failed on ToggleUserStatus:', auditErr);
        }
      }
    }

    return safeUpdated;
  }
}

module.exports = ToggleUserStatus;
