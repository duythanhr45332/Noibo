const bcrypt = require('bcrypt');
const ApiError = require('../../utils/api-error');
const HttpStatus = require('../../utils/http-status');
const { isValidRole } = require('../../domain/constants/roles');

class CreateUser {
  constructor({ userRepository, auditLogRepository, logger }) {
    this.userRepository = userRepository;
    this.auditLogRepository = auditLogRepository;
    this.logger = logger;
  }

  async execute({
    username,
    password,
    full_name,
    department = null,
    role,
    is_active = true,
    actorId = null,
  }) {
    const normalizedUsername = String(username || '').trim().toLowerCase();
    if (!normalizedUsername) {
      throw new ApiError(HttpStatus.BAD_REQUEST, 'Tên đăng nhập không được để trống', 'username');
    }

    if (!isValidRole(role)) {
      throw new ApiError(
        HttpStatus.BAD_REQUEST,
        'Vai trò không hợp lệ (ADMIN, BOD, ACCOUNTANT, AM, PM)',
        'role'
      );
    }

    const existing = await this.userRepository.findByUsername(normalizedUsername);
    if (existing) {
      throw new ApiError(
        HttpStatus.CONFLICT,
        `Tên đăng nhập "${normalizedUsername}" đã tồn tại`,
        'username'
      );
    }

    const password_hash = await bcrypt.hash(password, 10);

    const created = await this.userRepository.create({
      username: normalizedUsername,
      password_hash,
      full_name: String(full_name || '').trim(),
      department: department ? String(department).trim() : null,
      role,
      is_active: Boolean(is_active),
    });

    const safeCreated = created.toSafeObject ? created.toSafeObject() : created;

    if (this.auditLogRepository) {
      try {
        await this.auditLogRepository.create({
          entity_name: 'users',
          entity_id: safeCreated.user_id,
          action: 'CREATE_USER',
          old_values: null,
          new_values: {
            username: safeCreated.username,
            full_name: safeCreated.full_name,
            department: safeCreated.department,
            role: safeCreated.role,
            is_active: safeCreated.is_active,
          },
          changed_by: actorId,
        });
      } catch (auditErr) {
        if (this.logger) {
          this.logger.warn('Audit log failed on CreateUser:', auditErr);
        }
      }
    }

    return safeCreated;
  }
}

module.exports = CreateUser;
