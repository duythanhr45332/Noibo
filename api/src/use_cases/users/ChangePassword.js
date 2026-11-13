const bcrypt = require('bcrypt');
const HttpStatus = require('../../utils/http-status');
const ApiError = require('../../utils/api-error');

class ChangePassword {
    constructor({ userRepository, auditLogRepository, logger }) {
        this.userRepository = userRepository;
        this.auditLogRepository = auditLogRepository;
        this.logger = logger || console;
    }

    async execute({ user_id, old_password, new_password }) {
        try {
            if (!user_id || !old_password || !new_password) {
                const missingField = !old_password ? 'old_password' : 'new_password';
                throw new ApiError(HttpStatus.BAD_REQUEST, 'Vui lòng điền đầy đủ mật khẩu cũ và mật khẩu mới', missingField);
            }

            if (new_password.length < 6) {
                throw new ApiError(HttpStatus.BAD_REQUEST, 'Mật khẩu mới phải có tối thiểu 6 ký tự', 'new_password');
            }

            const user = await this.userRepository.findById(user_id);
            if (!user) {
                throw new ApiError(HttpStatus.NOT_FOUND, 'Không tìm thấy tài khoản người dùng');
            }

            // Verify old password
            const isMatch = await bcrypt.compare(old_password, user.password_hash);
            if (!isMatch) {
                throw new ApiError(HttpStatus.BAD_REQUEST, 'Mật khẩu cũ không chính xác', 'old_password');
            }

            // Hash new password
            const password_hash = await bcrypt.hash(new_password, 10);

            // Update user password
            await this.userRepository.updatePassword(user_id, password_hash);

            this.logger.info("Đổi mật khẩu thành công", {
                user_id: user.user_id,
                action: "CHANGE_PASSWORD"
            });

            if (this.auditLogRepository) {
                await this.auditLogRepository.create({
                    entity_name: 'users',
                    entity_id: user.user_id,
                    action: 'CHANGE_PASSWORD',
                    old_values: null,
                    new_values: null,
                    changed_by: user_id
                });
            }

            return true;
        } catch (error) {
            if (!(error instanceof ApiError)) {
                this.logger.error("Lỗi khi đổi mật khẩu", { error: error.message, user_id });
                throw new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'Lỗi hệ thống khi đổi mật khẩu');
            }
            throw error;
        }
    }
}

module.exports = ChangePassword;
