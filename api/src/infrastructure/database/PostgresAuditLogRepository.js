const db = require('../../config/database');

const SENSITIVE_ACTIONS = [
  'REOPEN_MILESTONE',
  'DISBURSE_MILESTONE_BONUS',
  'MARK_INSTALLMENT_PAID',
  'CLOSE_CONTRACT',
  'DELETE_CUSTOMER',
  'LOCK_USER',
  'UPDATE_USER_AND_RESET_PASSWORD',
  'CHANGE_PASSWORD',
];

class PostgresAuditLogRepository {
  async create({
    entity_name,
    entity_id,
    action,
    old_values = null,
    new_values = null,
    changed_by = null,
    client = null,
  }) {
    const executor = client || db;
    const query = `
      INSERT INTO audit_logs (
        entity_name,
        entity_id,
        action,
        old_values,
        new_values,
        changed_by
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6)
      RETURNING *
    `;

    const result = await executor.query(query, [
      entity_name,
      entity_id,
      action,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      changed_by,
    ]);

    return result.rows[0];
  }

  async findAllPaginated({
    page = 1,
    limit = 20,
    search = '',
    entity_name = '',
    action = '',
    changed_by = '',
    from_date = '',
    to_date = '',
  } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (safePage - 1) * safeLimit;

    const conditions = ['1 = 1'];
    const params = [];

    if (entity_name && entity_name.trim()) {
      params.push(entity_name.trim());
      conditions.push(`al.entity_name = $${params.length}`);
    }

    if (action && action.trim()) {
      params.push(action.trim());
      conditions.push(`al.action = $${params.length}`);
    }

    if (changed_by && changed_by.trim()) {
      params.push(changed_by.trim());
      conditions.push(`al.changed_by = $${params.length}`);
    }

    if (from_date && from_date.trim()) {
      params.push(from_date.trim());
      conditions.push(`al.created_at >= $${params.length}::date`);
    }

    if (to_date && to_date.trim()) {
      params.push(to_date.trim());
      conditions.push(`al.created_at < ($${params.length}::date + INTERVAL '1 day')`);
    }

    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`(
        al.action ILIKE $${params.length}
        OR al.entity_name ILIKE $${params.length}
        OR al.entity_id::text ILIKE $${params.length}
        OR COALESCE(u.full_name, '') ILIKE $${params.length}
        OR COALESCE(u.username, '') ILIKE $${params.length}
        OR COALESCE(al.old_values::text, '') ILIKE $${params.length}
        OR COALESCE(al.new_values::text, '') ILIKE $${params.length}
      )`);
    }

    const whereClause = conditions.join(' AND ');

    const summaryParams = [...params, SENSITIVE_ACTIONS];
    const sensitiveIdx = summaryParams.length;
    const summaryQuery = `
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE al.created_at >= CURRENT_DATE)::int AS today_count,
        COUNT(*) FILTER (WHERE al.action = ANY($${sensitiveIdx}::text[]))::int AS sensitive_count,
        COUNT(DISTINCT al.changed_by)::int AS unique_actors_count
      FROM audit_logs al
      LEFT JOIN users u ON u.user_id = al.changed_by
      WHERE ${whereClause}
    `;
    const summaryRes = await db.query(summaryQuery, summaryParams);
    const summaryRow = summaryRes.rows[0] || {};
    const total = Number(summaryRow.total || 0);

    const listParams = [...params, safeLimit, offset];
    const listQuery = `
      SELECT
        al.audit_log_id,
        al.entity_name,
        al.entity_id,
        al.action,
        al.old_values,
        al.new_values,
        al.changed_by,
        al.created_at,
        u.username AS actor_username,
        u.full_name AS actor_full_name,
        u.role AS actor_role
      FROM audit_logs al
      LEFT JOIN users u ON u.user_id = al.changed_by
      WHERE ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${listParams.length - 1}
      OFFSET $${listParams.length}
    `;
    const listRes = await db.query(listQuery, listParams);

    return {
      items: listRes.rows,
      summary: {
        total,
        today_count: Number(summaryRow.today_count || 0),
        sensitive_count: Number(summaryRow.sensitive_count || 0),
        unique_actors_count: Number(summaryRow.unique_actors_count || 0),
      },
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
  }
}

module.exports = PostgresAuditLogRepository;
