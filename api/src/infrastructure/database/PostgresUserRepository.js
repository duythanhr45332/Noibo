const db = require('../../config/database');
const User = require('../../domain/entities/User');

class PostgresUserRepository {
  async findByUsername(username) {
    const query =
      'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL';
    const result = await db.query(query, [username]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async findById(userId) {
    const query =
      'SELECT * FROM users WHERE user_id = $1 AND deleted_at IS NULL';
    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async updatePassword(userId, password_hash) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2 AND deleted_at IS NULL
      RETURNING *;
    `;
    const result = await db.query(query, [password_hash, userId]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }
}

module.exports = PostgresUserRepository;
