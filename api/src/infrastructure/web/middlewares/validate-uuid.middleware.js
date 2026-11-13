const HttpStatus = require('../../../utils/http-status');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Middleware kiểm tra tính hợp lệ của tham số UUID trên URL
 * @param {string} paramName Tên tham số URL cần kiểm tra (mặc định là 'id')
 */
const validateUuidParam = (paramName = 'id') => {
    return (req, res, next) => {
        const val = req.params[paramName];
        if (!val || !UUID_REGEX.test(val)) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                data: null,
                errors: [{
                    field: paramName,
                    message: `Mã định danh ${paramName} không hợp lệ (yêu cầu định dạng UUID)`
                }],
                timestamp: new Date().toISOString()
            });
        }
        next();
    };
};

module.exports = validateUuidParam;
