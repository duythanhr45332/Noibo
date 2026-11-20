const db = require('../../config/database');
const User = require('../../domain/entities/User');
const UserRepository = require('../../domain/repositories/user.repository');

const SAFE_USER_COLUMNS = `
  user_id,
  username,
  full_name,
  department,
  role,
  is_active,
  deleted_at,
  created_at,
  updated_at
`;

class PostgresUserRepository extends UserRepository {
  async findByUsername(username) {
    const query =
      'SELECT * FROM users WHERE username = $1 AND deleted_at IS NULL';
    const result = await db.query(query, [username]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async findById(userId) {
    const query = `
      SELECT ${SAFE_USER_COLUMNS}
      FROM users
      WHERE user_id = $1 AND deleted_at IS NULL
    `;
    const result = await db.query(query, [userId]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async findAllPaginated({
    page = 1,
    limit = 20,
    search = '',
    role = '',
    isActive = null,
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['deleted_at IS NULL'];
    const params = [];

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(
        `(username ILIKE $${params.length} OR full_name ILIKE $${params.length} OR COALESCE(department, '') ILIKE $${params.length})`
      );
    }

    if (role && role.trim()) {
      params.push(role.trim());
      conditions.push(`role = $${params.length}`);
    }

    if (typeof isActive === 'boolean') {
      params.push(isActive);
      conditions.push(`is_active = $${params.length}`);
    }

    const whereClause = conditions.join(' AND ');

    const countQuery = `SELECT COUNT(*)::int AS total FROM users WHERE ${whereClause}`;
    const countRes = await db.query(countQuery, params);
    const total = countRes.rows[0]?.total || 0;

    const listParams = [...params, safeLimit, offset];
    const listQuery = `
      SELECT ${SAFE_USER_COLUMNS}
      FROM users
      WHERE ${whereClause}
      ORDER BY created_at DESC, username ASC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `;

    const listRes = await db.query(listQuery, listParams);
    const items = listRes.rows.map((row) => new User(row).toSafeObject());
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));

    return {
      items,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages,
      },
    };
  }

  async findActiveOptions({ role = '' } = {}) {
    const conditions = ['deleted_at IS NULL', 'is_active = true'];
    const params = [];

    if (role && role.trim()) {
      params.push(role.trim());
      conditions.push(`role = $${params.length}`);
    }

    const query = `
      SELECT user_id, username, full_name, department, role
      FROM users
      WHERE ${conditions.join(' AND ')}
      ORDER BY full_name ASC, username ASC
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  async countActiveByRole(role) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM users
      WHERE role = $1 AND is_active = true AND deleted_at IS NULL
    `;
    const result = await db.query(query, [role]);
    return result.rows[0]?.total || 0;
  }

  async create(
    { username, password_hash, full_name, department = null, role, is_active = true },
    client = null
  ) {
    const executor = client || db;
    const query = `
      INSERT INTO users (username, password_hash, full_name, department, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING ${SAFE_USER_COLUMNS}
    `;
    const result = await executor.query(query, [
      username,
      password_hash,
      full_name,
      department || null,
      role,
      is_active,
    ]);
    return new User(result.rows[0]);
  }

  async update(
    userId,
    { full_name, department, role, is_active, password_hash },
    client = null
  ) {
    const executor = client || db;
    const fields = [];
    const params = [];

    if (full_name !== undefined) {
      params.push(full_name);
      fields.push(`full_name = $${params.length}`);
    }
    if (department !== undefined) {
      params.push(department || null);
      fields.push(`department = $${params.length}`);
    }
    if (role !== undefined) {
      params.push(role);
      fields.push(`role = $${params.length}`);
    }
    if (is_active !== undefined) {
      params.push(is_active);
      fields.push(`is_active = $${params.length}`);
    }
    if (password_hash !== undefined) {
      params.push(password_hash);
      fields.push(`password_hash = $${params.length}`);
    }

    if (fields.length === 0) {
      return this.findById(userId);
    }

    fields.push('updated_at = NOW()');
    params.push(userId);

    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE user_id = $${params.length} AND deleted_at IS NULL
      RETURNING ${SAFE_USER_COLUMNS}
    `;

    const result = await executor.query(query, params);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async updateStatus(userId, isActive) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        `
          UPDATE users
          SET is_active = $1, updated_at = NOW()
          WHERE user_id = $2 AND deleted_at IS NULL
          RETURNING ${SAFE_USER_COLUMNS}
        `,
        [isActive, userId]
      );

      if (updateRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      if (!isActive) {
        await client.query(
          `
            UPDATE refresh_tokens
            SET revoked_at = NOW(), updated_at = NOW()
            WHERE user_id = $1 AND revoked_at IS NULL
          `,
          [userId]
        );
      }

      await client.query('COMMIT');
      return new User(updateRes.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePassword(userId, password_hash) {
    const query = `
      UPDATE users
      SET password_hash = $1, updated_at = NOW()
      WHERE user_id = $2 AND deleted_at IS NULL
      RETURNING ${SAFE_USER_COLUMNS};
    `;
    const result = await db.query(query, [password_hash, userId]);
    if (result.rows.length === 0) return null;
    return new User(result.rows[0]);
  }

  async softDelete(userId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const deleteRes = await client.query(
        `
          UPDATE users
          SET deleted_at = NOW(), is_active = false, updated_at = NOW()
          WHERE user_id = $1 AND deleted_at IS NULL
          RETURNING ${SAFE_USER_COLUMNS}
        `,
        [userId]
      );

      if (deleteRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query(
        `
          UPDATE refresh_tokens
          SET revoked_at = NOW(), updated_at = NOW()
          WHERE user_id = $1 AND revoked_at IS NULL
        `,
        [userId]
      );

      await client.query('COMMIT');
      return new User(deleteRes.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = PostgresUserRepository;
