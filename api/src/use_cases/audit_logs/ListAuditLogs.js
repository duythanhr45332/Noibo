function sanitizeSnapshot(value) {
  if (!value || typeof value !== 'object') return value ?? null;
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (k.toLowerCase().includes('password')) continue;
    out[k] = sanitizeSnapshot(v);
  }
  return out;
}

class ListAuditLogs {
  constructor({ auditLogRepository }) {
    this.auditLogRepository = auditLogRepository;
  }

  async execute(filters = {}) {
    const result = await this.auditLogRepository.findAllPaginated(filters);
    return {
      ...result,
      items: (result.items || []).map((row) => ({
        audit_log_id: row.audit_log_id,
        entity_name: row.entity_name,
        entity_id: row.entity_id,
        action: row.action,
        old_values: sanitizeSnapshot(row.old_values),
        new_values: sanitizeSnapshot(row.new_values),
        changed_by: row.changed_by || null,
        actor_username: row.actor_username || null,
        actor_full_name: row.actor_full_name || null,
        actor_role: row.actor_role || null,
        created_at: row.created_at,
      })),
    };
  }
}

module.exports = ListAuditLogs;
