/**
 * Class mở rộng từ Error mặc định của Node.js
 * Giúp định nghĩa mã lỗi HTTP Status đi kèm với thông báo lỗi
 * Theo chuẩn yêu cầu tại TECHNICAL_GUIDELINE.md
 */
class ApiError extends Error {
    constructor(status, message, field = null) {
        super(message);
        this.status = status;
        this.field = field;
        this.name = this.constructor.name;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = ApiError;
