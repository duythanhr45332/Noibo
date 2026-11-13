const GetMeProfile = require('./GetMeProfile');

describe('GetMeProfile Use Case', () => {
  let mockUserRepository;
  let getMeProfile;

  beforeEach(() => {
    mockUserRepository = {
      findById: jest.fn(),
    };
    getMeProfile = new GetMeProfile(mockUserRepository);
  });

  it('should throw 401 UNAUTHORIZED when userId is missing', async () => {
    await expect(getMeProfile.execute(null)).rejects.toMatchObject({
      statusCode: 401,
      code: 'UNAUTHORIZED',
    });
  });

  it('should throw 404 USER_NOT_FOUND when user does not exist', async () => {
    mockUserRepository.findById.mockResolvedValue(null);

    await expect(getMeProfile.execute('non-existent-uuid')).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('should throw 403 ACCOUNT_DISABLED when user is inactive', async () => {
    mockUserRepository.findById.mockResolvedValue({
      user_id: 'uuid-1',
      username: 'disabled_user',
      is_active: false,
    });

    await expect(getMeProfile.execute('uuid-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'ACCOUNT_DISABLED',
    });
  });

  it('should return clean profile when user is active', async () => {
    const fakeUser = {
      user_id: 'uuid-admin',
      username: 'admin_root',
      full_name: 'Quản trị viên Hệ thống (Root)',
      role: 'ADMIN',
      is_active: true,
      created_at: new Date('2026-01-01T00:00:00Z'),
      updated_at: new Date('2026-01-02T00:00:00Z'),
    };

    mockUserRepository.findById.mockResolvedValue(fakeUser);

    const result = await getMeProfile.execute('uuid-admin');

    expect(mockUserRepository.findById).toHaveBeenCalledWith('uuid-admin');
    expect(result).toEqual({
      id: 'uuid-admin',
      user_id: 'uuid-admin',
      username: 'admin_root',
      full_name: 'Quản trị viên Hệ thống (Root)',
      role: 'ADMIN',
      is_active: true,
      created_at: fakeUser.created_at,
      updated_at: fakeUser.updated_at,
    });
    expect(result.password_hash).toBeUndefined();
  });
});
