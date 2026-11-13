const HttpStatus = require('./http-status');
const ApiError = require('./api-error');

/**
 * Xử lý lỗi PostgreSQL thành ApiError có ý nghĩa và mã lỗi phù hợp (AGENTS.md Rule 2).
 * Tự động chuyển đổi các mã lỗi cơ sở dữ liệu phổ biến thành thông điệp tiếng Việt thân thiện,
 * chỉ rõ field vi phạm để Form có thể gán lỗi chính xác.
 * 
 * @param {Error} error - Lỗi bắt được từ try-catch
 * @param {Object} [customConstraintMap] - Map constraint name -> { message, field, status } hoặc string message
 * @param {string} [fallbackMessage] - Thông báo fallback khi không phải lỗi DB đã biết
 * @param {Object} [logger] - Logger instance để ghi log chi tiết khi fallback
 * @returns {ApiError}
 */
function handleDatabaseError(error, customConstraintMap = {}, fallbackMessage = 'Lỗi hệ thống, vui lòng thử lại', logger = null) {
    if (error instanceof ApiError) return error;

    const constraintName = error.constraint || '';
    const detail = error.detail || '';
    const message = error.message || '';

    // 1. Kiểm tra customConstraintMap trước tiên
    for (const [key, mapping] of Object.entries(customConstraintMap)) {
        if (constraintName.includes(key) || detail.includes(key) || message.includes(key)) {
            if (typeof mapping === 'string') {
                return new ApiError(HttpStatus.CONFLICT, mapping);
            }
            return new ApiError(
                mapping.status || HttpStatus.CONFLICT,
                mapping.message,
                mapping.field || null
            );
        }
    }

    // 2. Mã lỗi PostgreSQL: 23505 - Unique constraint violation
    if (error.code === '23505') {
        const textToSearch = `${constraintName} ${detail} ${message}`.toLowerCase();

        if (textToSearch.includes('username')) {
            return new ApiError(HttpStatus.CONFLICT, 'Tên đăng nhập đã tồn tại trong hệ thống. Vui lòng chọn tên khác.', 'username');
        }
        if (textToSearch.includes('phone')) {
            return new ApiError(HttpStatus.CONFLICT, 'Số điện thoại đã được sử dụng trong hệ thống.', 'phone_number');
        }
        if (textToSearch.includes('id_card') || textToSearch.includes('cccd') || textToSearch.includes('cmnd')) {
            return new ApiError(HttpStatus.CONFLICT, 'Số CCCD/CMND đã tồn tại trong hệ thống.', 'id_card_number');
        }
        if (textToSearch.includes('email')) {
            return new ApiError(HttpStatus.CONFLICT, 'Email đã được sử dụng trong hệ thống.', 'email');
        }
        if (textToSearch.includes('tax_code') || textToSearch.includes('tax')) {
            return new ApiError(HttpStatus.CONFLICT, 'Mã số thuế đã tồn tại trong hệ thống.', 'tax_code');
        }
        if (textToSearch.includes('code')) {
            return new ApiError(HttpStatus.CONFLICT, 'Mã này đã tồn tại trong hệ thống. Vui lòng chọn mã khác.', 'code');
        }
        if (textToSearch.includes('name')) {
            return new ApiError(HttpStatus.CONFLICT, 'Tên này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.', 'name');
        }

        return new ApiError(HttpStatus.CONFLICT, 'Dữ liệu bị trùng lặp trong hệ thống.');
    }

    // 3. Mã lỗi PostgreSQL: 23503 - Foreign key violation
    if (error.code === '23503') {
        const textToSearch = `${constraintName} ${detail} ${message}`.toLowerCase();

        if (textToSearch.includes('role')) {
            return new ApiError(HttpStatus.BAD_REQUEST, 'Vai trò/nhóm quyền liên kết không tồn tại hoặc đã bị xóa.', 'role_id');
        }
        if (textToSearch.includes('user') || textToSearch.includes('creator')) {
            return new ApiError(HttpStatus.BAD_REQUEST, 'Tài khoản người dùng liên kết không tồn tại hoặc đã bị vô hiệu hóa.', 'user_id');
        }
        if (textToSearch.includes('category')) {
            return new ApiError(HttpStatus.BAD_REQUEST, 'Danh mục liên kết không tồn tại hoặc đã bị xóa.', 'category_id');
        }
        if (textToSearch.includes('customer')) {
            return new ApiError(HttpStatus.BAD_REQUEST, 'Khách hàng liên kết không tồn tại hoặc đã bị xóa.', 'customer_id');
        }

        return new ApiError(HttpStatus.BAD_REQUEST, 'Dữ liệu liên kết không tồn tại hoặc đã bị thay đổi.');
    }

    // 4. Mã lỗi PostgreSQL: 23502 - Not null violation
    if (error.code === '23502') {
        const column = error.column || 'thông tin bắt buộc';
        return new ApiError(HttpStatus.BAD_REQUEST, `Vui lòng điền đầy đủ trường: ${column}`, error.column);
    }

    // 5. Mã lỗi PostgreSQL: 22001 - String data right truncation
    if (error.code === '22001') {
        return new ApiError(HttpStatus.BAD_REQUEST, 'Dữ liệu nhập vào vượt quá độ dài tối đa cho phép.');
    }

    // 6. Mã lỗi PostgreSQL: 22P02 - Invalid text representation
    if (error.code === '22P02') {
        return new ApiError(HttpStatus.BAD_REQUEST, 'Định dạng dữ liệu không hợp lệ (mã ID hoặc số không đúng chuẩn).');
    }

    // 7. Fallback: Log chi tiết lỗi kỹ thuật và ném lỗi hệ thống (AGENTS.md Rule 2)
    if (logger && typeof logger.error === 'function') {
        logger.error(fallbackMessage, {
            error: error.message,
            code: error.code,
            detail: error.detail,
            stack: error.stack
        });
    }

    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, fallbackMessage);
}

module.exports = handleDatabaseError;
