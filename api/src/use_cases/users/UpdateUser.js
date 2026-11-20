const bcrypt = require('bcrypt');
const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { ROLES, isValidRole } = require('../../domain/constants/roles');

class UpdateUser {
  constructor({ userRepository, auditLogRepository, logger }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute(userId, { full_name, department, role, new_password, actorId = null }) {
    const existing = await this.userRepository.findById(userId);
    if (!existing) {
      throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy người dùng', 'userId');
    }

    if (role !== undefined && !isValidRole(role)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Vai trò không hợp lệ (ADMIN, BOD, ACCOUNTANT, AM, PM)',
        'role'
      );
    }

    if (
      existing.role === ROLES.ADMIN &&
      role !== undefined &&
      role !== ROLES.ADMIN
    ) {
      if (String(actorId) === String(userId)) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Không thể tự hạ quyền ADMIN của chính mình',
          'role'
        );
      }
      const adminCount = await this.userRepository.countActiveByRole(ROLES.ADMIN);
      if (adminCount <= 1) {
        throw new ApiError(
          HttpStatus.BAD_REQUEST,
          'Hệ thống phải còn ít nhất 1 tài khoản ADMIN đang hoạt động',
          'role'
        );
      }
    }

    const patch = {};
    if (full_name !== undefined) patch.full_name = String(full_name).trim();
    if (department !== undefined) {
      patch.department = department ? String(department).trim() : null;
    }
    if (role !== undefined) patch.role = role;
    if (new_password && String(new_password).trim().length > 0) {
      patch.password_hash = await bcrypt.hash(String(new_password), 10);
    }

    const updated = await this.userRepository.update(userId, patch);
    const safeUpdated = updated.toSafeObject ? updated.toSafeObject() : updated;

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'users',
          entity_id: userId,
          action: patch.password_hash ? 'UPDATE_USER_AND_RESET_PASSWORD' : 'UPDATE_USER',
          old_values: {
            full_name: existing.full_name,
            department: existing.department,
            role: existing.role,
          },
          new_values: {
            full_name: safeUpdated.full_name,
            department: safeUpdated.department,
            role: safeUpdated.role,
            password_reset: Boolean(patch.password_hash),
          },
          changed_by: actorId,
        });
      } catch (auditErr) {
        if (this.logger) {
          this.logger.warn('Audit log failed on UpdateUser:', auditErr);
        }
      }
    }

    return safeUpdated;
  }
}

module.exports = UpdateUser;
