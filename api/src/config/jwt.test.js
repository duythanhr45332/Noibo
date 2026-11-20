const {
  JWT_ALGORITHM,
  getJwtSecret,
  assertJwtConfig,
  _resetEphemeralSecretForTest,
} = require('./jwt');

describe('JWT Secret Security Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetEphemeralSecretForTest();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws fatal error in production when JWT_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    expect(() => assertJwtConfig()).toThrow(/JWT_SECRET là bắt buộc/i);
  });

  it('throws fatal error in production when JWT_SECRET is shorter than 32 chars', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'short_secret_12345';
    expect(() => assertJwtConfig()).toThrow(/tối thiểu 32 ký tự/i);
  });

  it('throws fatal error in production when using old hardcoded fallback string', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'fallback_secret_key_for_development_only';
    expect(() => assertJwtConfig()).toThrow(/mặc định\/yếu/i);
  });

  it('returns strong JWT_SECRET in production when >= 32 chars', () => {
    process.env.NODE_ENV = 'production';
    const strong = 'a9f3e7b1c2d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2';
    process.env.JWT_SECRET = strong;
    expect(assertJwtConfig()).toBe(strong);
    expect(JWT_ALGORITHM).toBe('HS256');
  });

  it('generates a strong ephemeral random secret (not hardcoded) in non-production when env missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JWT_SECRET;
    const s1 = getJwtSecret();
    const s2 = getJwtSecret();
    expect(s1).toBe(s2); // consistent within process
    expect(s1.length).toBe(96);
    expect(s1).not.toBe('fallback_secret_key_for_development_only');

    _resetEphemeralSecretForTest();
    const s3 = getJwtSecret();
    expect(s3).not.toBe(s1); // fresh random per process
  });
});
