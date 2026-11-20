const CreateUser = require('./CreateUser');
const ApiError = require('../../utils/api-error');

describe('CreateUser Use Case', () => {
  const makeDeps = (overrides = {}) => ({
    userRepository: {
      findByUsername: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (data) => ({
        user_id: '11111111-1111-4111-8111-111111111111',
        ...data,
        toSafeObject() {
          const { password_hash: _ph, ...safe } = this;
          return safe;
        },
      })),
      ...overrides.userRepository,
    },
    auditLogRepository: {
      create: jest.fn().mockResolvedValue({}),
      ...overrides.auditLogRepository,
    },
  });

  it('creates a user with hashed password, lowercased username, and audit log', async () => {
    const deps = makeDeps();
    const useCase = new CreateUser(deps);

    const created = await useCase.execute({
      username: ' Thao.AM ',
      password: 'Password123!',
      full_name: 'Nguyễn Thảo',
      department: 'AM Team',
      role: 'AM',
      actorId: 'admin-1',
    });

    expect(created.username).toBe('thao.am');
    expect(created.password_hash).toBeUndefined();
    expect(deps.userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'thao.am',
        full_name: 'Nguyễn Thảo',
        role: 'AM',
        is_active: true,
      })
    );
    const passedHash = deps.userRepository.create.mock.calls[0][0].password_hash;
    expect(passedHash).not.toBe('Password123!');
    expect(deps.auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_name: 'users',
        action: 'CREATE_USER',
        changed_by: 'admin-1',
      })
    );
  });

  it('rejects duplicate username with 409 CONFLICT', async () => {
    const deps = makeDeps({
      userRepository: {
        findByUsername: jest.fn().mockResolvedValue({ user_id: 'u1', username: 'thao.am' }),
      },
    });
    const useCase = new CreateUser(deps);

    await expect(
      useCase.execute({
        username: 'thao.am',
        password: 'Password123!',
        full_name: 'Thảo',
        role: 'AM',
      })
    ).rejects.toThrow(ApiError);
  });

  it('rejects invalid role with 400 BAD_REQUEST', async () => {
    const deps = makeDeps();
    const useCase = new CreateUser(deps);

    await expect(
      useCase.execute({
        username: 'invalid.user',
        password: 'Password123!',
        full_name: 'Invalid',
        role: 'SUPERUSER',
      })
    ).rejects.toMatchObject({ status: 400, field: 'role' });
  });
});
