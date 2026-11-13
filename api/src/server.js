require('./polyfill');
const app = require('./app');

// Port mặc định 8081 (tách biệt với VPCC chạy ở 8080)
const PORT = process.env.PORT || 8081;

const server = app.listen(PORT, () => {
    console.log(`🚀 Hệ thống ERP-AM Backend đang chạy tại http://localhost:${PORT}`);
    console.log(`- Swagger UI: http://localhost:${PORT}/api-docs`);
    console.log(`- API Auth (Đăng nhập): http://localhost:${PORT}/api/v1/auth/login`);
    console.log(`- API Users (Nhân sự): http://localhost:${PORT}/api/v1/users`);
    console.log(`- API Roles (Phân quyền): http://localhost:${PORT}/api/v1/roles`);
});

// Graceful Shutdown: Handle Docker/PM2/terminal stop signals
let isShuttingDown = false;
const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
        console.log('⚡ Nhận tín hiệu lần 2. Thoát ngay lập tức!');
        process.exit(0);
    }
    isShuttingDown = true;
    console.log(`\n🛑 Nhận tín hiệu ${signal}. Bắt đầu quá trình Graceful Shutdown...`);

    // 1. Đóng toàn bộ các kết nối SSE đang mở
    try {
        const sseManager = require('./infrastructure/services/SseManager');
        sseManager.closeAll();
    } catch (e) {}

    // 2. Buộc đóng tất cả HTTP socket connections (Node 18.2+) để server.close() không bị treo
    if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
    }

    // 3. Timeout tối đa 1.5 giây để ép thoát nếu còn kết nối kẹt
    const forceExitTimer = setTimeout(() => {
        console.error('⚠️ Quá thời gian chờ Graceful Shutdown. Bắt buộc thoát!');
        process.exit(0);
    }, 1500);
    if (forceExitTimer.unref) forceExitTimer.unref();

    server.close(async () => {
        console.log('✅ Đã ngắt kết nối HTTP server (Không nhận request mới).');

        try {
            const { pool } = require('./config/database');
            await pool.end();
            console.log('✅ Đã giải phóng hoàn toàn các kết nối Database.');
            clearTimeout(forceExitTimer);
            process.exit(0);
        } catch (err) {
            console.error('❌ Lỗi trong quá trình ngắt kết nối Database:', err);
            process.exit(1);
        }
    });
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
