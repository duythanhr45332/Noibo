const UpdateUser = require('./UpdateUser');

describe('UpdateUser Use Case', () => {
  it('updates user info and records audit log', async () => {
    const existing = {
      user_id: 'u-am-1',
      username: 'thao.am',
      full_name: 'Thảo AM',
      department: 'Sales',
      role: 'AM',
    };
    const userRepository = {
      findById: jest.fn().mockResolvedValue(existing),
      countActiveByRole: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({
        ...existing,
        full_name: 'Thảo Senior AM',
        department: 'Enterprise AM',
        role: 'BOD',
        toSafeObject() {
          return this;
        },
      }),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue({}) };
    const useCase = new UpdateUser({ userRepository, auditLogRepository });

    const res = await useCase.execute('u-am-1', {
      full_name: 'Thảo Senior AM',
      department: 'Enterprise AM',
      role: 'BOD',
      actorId: 'admin-1',
    });

    expect(res.role).toBe('BOD');
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_name: 'users',
        entity_id: 'u-am-1',
        action: 'UPDATE_USER',
      })
    );
  });

  it('prevents self-demotion of an ADMIN user', async () => {
    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        user_id: 'admin-1',
        role: 'ADMIN',
      }),
    };
    const useCase = new UpdateUser({ userRepository });

    await expect(
      useCase.execute('admin-1', {
        role: 'AM',
        actorId: 'admin-1',
      })
    ).rejects.toMatchObject({ status: 400, field: 'role' });
  });

  it('prevents demoting the last active ADMIN user', async () => {
    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        user_id: 'admin-1',
        role: 'ADMIN',
      }),
      countActiveByRole: jest.fn().mockResolvedValue(1),
    };
    const useCase = new UpdateUser({ userRepository });

    await expect(
      useCase.execute('admin-1', {
        role: 'BOD',
        actorId: 'bod-1',
      })
    ).rejects.toMatchObject({ status: 400, field: 'role' });
  });
});
