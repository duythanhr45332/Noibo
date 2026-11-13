/**
 * Tiện ích Structured Logging siêu nhẹ dùng tạm thời cho môi trường Node.js gốc.
 * Trong tương lai có thể được thay thế bằng Winston hoặc Pino nếu cần.
 * Đảm bảo mọi log luôn là Object thay vì cộng chuỗi thô.
 */
const logger = {
    info: (message, data = {}) => {
        console.log(JSON.stringify({ 
            level: 'INFO', 
            message, 
            ...data, 
            timestamp: new Date().toISOString() 
        }));
    },
    error: (message, error = {}) => {
        console.error(JSON.stringify({ 
            level: 'ERROR', 
            message, 
            ...error, 
            timestamp: new Date().toISOString() 
        }));
    },
    warn: (message, data = {}) => {
        console.warn(JSON.stringify({ 
            level: 'WARN', 
            message, 
            ...data, 
            timestamp: new Date().toISOString() 
        }));
    }
};

module.exports = logger;
