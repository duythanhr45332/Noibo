require('dotenv').config();
const { Pool } = require('pg');

// Khởi tạo Connection Pool theo quy chuẩn TECHNICAL_GUIDELINE.md
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'erp_am_db',
    password: process.env.DB_PASSWORD || 'postgres',
    port: Number(process.env.DB_PORT) || 5433,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    keepAlive: true,
});

const isDev = process.env.NODE_ENV !== 'production';

// Monkey patch pool.query cho môi trường dev để tự động log SQL queries & thời gian thực thi
const originalPoolQuery = pool.query.bind(pool);

pool.query = async function (text, params, callback) {
    const start = Date.now();
    try {
        const result = await originalPoolQuery(text, params, callback);
        const duration = Date.now() - start;

        if (isDev && process.env.LOG_SQL !== 'false') {
            const sqlText = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : JSON.stringify(text);
            console.log(`\x1b[36m[SQL Query] (${duration}ms)\x1b[0m ${sqlText}`);
            if (params && params.length > 0) {
                console.log(`\x1b[33m[SQL Params]\x1b[0m`, params);
            }
        }

        return result;
    } catch (error) {
        const duration = Date.now() - start;
        if (isDev && process.env.LOG_SQL !== 'false') {
            const sqlText = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : JSON.stringify(text);
            console.error(`\x1b[31m[SQL Error] (${duration}ms)\x1b[0m ${sqlText}`);
            console.error(`\x1b[31m[SQL Message]\x1b[0m ${error.message}`);
        }
        throw error;
    }
};

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};
