const ListAuditLogs = require('./ListAuditLogs');

describe('ListAuditLogs Use Case', () => {
  test('returns paginated audit logs, summary, and strips password fields from snapshots', async () => {
    const auditLogRepository = {
      findAllPaginated: jest.fn().mockResolvedValue({
        items: [
          {
            audit_log_id: 'al-1',
            entity_name: 'users',
            entity_id: 'u-1',
            action: 'UPDATE_USER_AND_RESET_PASSWORD',
            old_values: { full_name: 'A', password_hash: 'secret1' },
            new_values: { full_name: 'B', password_hash: 'secret2', nested: { password: '123', role: 'AM' } },
            changed_by: 'admin-1',
            actor_username: 'admin',
            actor_full_name: 'System Admin',
            actor_role: 'ADMIN',
            created_at: '2026-11-19T03:00:00.000Z',
          },
        ],
        summary: {
          total: 1,
          today_count: 1,
          sensitive_count: 1,
          unique_actors_count: 1,
        },
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      }),
    };

    const useCase = new ListAuditLogs({ auditLogRepository });
    const res = await useCase.execute({ page: 1, limit: 20, entity_name: 'users' });

    expect(auditLogRepository.findAllPaginated).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      entity_name: 'users',
    });
    expect(res.summary.sensitive_count).toBe(1);
    expect(res.items[0].old_values).toEqual({ full_name: 'A' });
    expect(res.items[0].new_values).toEqual({ full_name: 'B', nested: { role: 'AM' } });
  });
});
