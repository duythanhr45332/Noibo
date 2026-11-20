const ToggleUserStatus = require('./ToggleUserStatus');

describe('ToggleUserStatus Use Case', () => {
  it('blocks self-locking', async () => {
    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        user_id: 'admin-1',
        role: 'ADMIN',
        is_active: true,
      }),
    };
    const useCase = new ToggleUserStatus({ userRepository });

    await expect(
      useCase.execute('admin-1', { is_active: false, actorId: 'admin-1' })
    ).rejects.toMatchObject({ status: 400, field: 'is_active' });
  });

  it('blocks locking the last active ADMIN', async () => {
    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        user_id: 'admin-1',
        role: 'ADMIN',
        is_active: true,
      }),
      countActiveByRole: jest.fn().mockResolvedValue(1),
    };
    const useCase = new ToggleUserStatus({ userRepository });

    await expect(
      useCase.execute('admin-1', { is_active: false, actorId: 'bod-1' })
    ).rejects.toMatchObject({ status: 400, field: 'is_active' });
  });

  it('locks user and writes audit log when allowed', async () => {
    const userRepository = {
      findById: jest.fn().mockResolvedValue({
        user_id: 'u-2',
        role: 'AM',
        is_active: true,
      }),
      updateStatus: jest.fn().mockResolvedValue({
        user_id: 'u-2',
        role: 'AM',
        is_active: false,
        toSafeObject() {
          return this;
        },
      }),
    };
    const auditLogRepository = { create: jest.fn().mockResolvedValue({}) };
    const useCase = new ToggleUserStatus({ userRepository, auditLogRepository });

    const res = await useCase.execute('u-2', {
      is_active: false,
      actorId: 'admin-1',
    });

    expect(res.is_active).toBe(false);
    expect(userRepository.updateStatus).toHaveBeenCalledWith('u-2', false);
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_name: 'users',
        entity_id: 'u-2',
        action: 'LOCK_USER',
      })
    );
  });
});
