const pool = require('../../config/database');

class PostgresTokenRepository {
    async createToken(userId, token, expiresAt) {
        const query = `
            INSERT INTO refresh_tokens (user_id, token, expires_at)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        const result = await pool.query(query, [userId, token, expiresAt]);
        return result.rows[0];
    }

    async findByToken(token) {
        const query = `
            SELECT token, user_id, expires_at, revoked_at, created_at, updated_at FROM refresh_tokens 
            WHERE token = $1
        `;
        const result = await pool.query(query, [token]);
        return result.rows[0] || null;
    }

    async revokeToken(token) {
        const query = `
            UPDATE refresh_tokens
            SET revoked_at = current_timestamp, updated_at = current_timestamp
            WHERE token = $1
            RETURNING *;
        `;
        const result = await pool.query(query, [token]);
        return result.rows[0] || null;
    }

    async revokeAllUserTokens(userId) {
        const query = `
            UPDATE refresh_tokens
            SET revoked_at = current_timestamp, updated_at = current_timestamp
            WHERE user_id = $1 AND revoked_at IS NULL
            RETURNING *;
        `;
        const result = await pool.query(query, [userId]);
        return result.rows;
    }
}

module.exports = PostgresTokenRepository;
