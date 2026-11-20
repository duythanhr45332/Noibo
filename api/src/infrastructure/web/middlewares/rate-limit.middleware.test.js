const express = require('express');
const request = require('supertest');
const {
  createRateLimiter,
  loginRateLimiter,
  changePasswordRateLimiter,
  refreshRateLimiter,
  resetAllLimiters,
} = require('./rate-limit.middleware');

describe('Rate Limiting Middleware (Brute-force Protection)', () => {
  beforeEach(() => {
    resetAllLimiters();
  });

  it('blocks login after 5 failed attempts for the same IP + username and returns 429 + Retry-After', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', ...loginRateLimiter, (req, res) => {
      if (req.body.password === 'Correct@123') {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ success: false, errors: [{ message: 'Sai mật khẩu' }] });
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post('/login')
        .send({ username: 'am_test', password: 'WrongPassword' });
      expect(res.status).toBe(401);
    }

    // Attempt #6 MUST be blocked with 429 even if password is now correct
    const blocked = await request(app)
      .post('/login')
      .send({ username: 'am_test', password: 'Correct@123' });
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.success).toBe(false);
    expect(blocked.body.errors[0].code).toBe('TOO_MANY_REQUESTS');

    // A different user from the same office IP is NOT locked out!
    const otherUser = await request(app)
      .post('/login')
      .send({ username: 'bod_test', password: 'Correct@123' });
    expect(otherUser.status).toBe(200);
  });

  it('resets failed attempt counter immediately after a successful login', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', ...loginRateLimiter, (req, res) => {
      if (req.body.password === 'Correct@123') {
        return res.status(200).json({ success: true });
      }
      return res.status(401).json({ success: false });
    });

    // 4 failed attempts
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/login')
        .send({ username: 'am_test', password: 'Bad' });
      expect(res.status).toBe(401);
    }

    // 1 successful login resets counter
    const ok = await request(app)
      .post('/login')
      .send({ username: 'am_test', password: 'Correct@123' });
    expect(ok.status).toBe(200);

    // Next 4 failed attempts are allowed again (counter was reset)
    for (let i = 0; i < 4; i++) {
      const res = await request(app)
        .post('/login')
        .send({ username: 'am_test', password: 'Bad' });
      expect(res.status).toBe(401);
    }
  });

  it('blocks credential stuffing across many usernames from the same IP after 30 failures', async () => {
    const app = express();
    app.use(express.json());
    app.post('/login', ...loginRateLimiter, (_req, res) => {
      return res.status(401).json({ success: false });
    });

    for (let i = 0; i < 30; i++) {
      const res = await request(app)
        .post('/login')
        .send({ username: `user_${i}`, password: 'Wrong' });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post('/login')
      .send({ username: 'user_999', password: 'Wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.errors[0].code).toBe('TOO_MANY_REQUESTS');
  });

  it('blocks change-password after 5 failed old_password attempts', async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { user_id: 'u-1' };
      next();
    });
    app.put('/change-password', changePasswordRateLimiter, (req, res) => {
      if (req.body.old_password === 'RightOld') return res.status(200).json({ success: true });
      return res.status(400).json({ success: false });
    });

    for (let i = 0; i < 5; i++) {
      const res = await request(app).put('/change-password').send({ old_password: 'Wrong' });
      expect(res.status).toBe(400);
    }

    const blocked = await request(app).put('/change-password').send({ old_password: 'RightOld' });
    expect(blocked.status).toBe(429);
  });

  it('enforces custom fixed-window limiter and resets after window expires', async () => {
    const fastLimiter = createRateLimiter({
      windowMs: 60,
      max: 2,
      keyGenerator: () => 'fixed-key',
    });
    const app = express();
    app.get('/ping', fastLimiter, (_req, res) => res.status(200).json({ ok: true }));

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(429);

    await new Promise((r) => setTimeout(r, 80));
    expect((await request(app).get('/ping')).status).toBe(200);
  });

  it('rate-limits refresh endpoint when spammed', async () => {
    const app = express();
    app.post('/refresh', refreshRateLimiter, (_req, res) => res.status(401).json({ success: false }));

    for (let i = 0; i < 30; i++) {
      const res = await request(app).post('/refresh');
      expect(res.status).toBe(401);
    }
    const blocked = await request(app).post('/refresh');
    expect(blocked.status).toBe(429);
  });
});
