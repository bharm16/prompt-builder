import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { applyRateLimitingMiddleware } from '../middleware.config';

describe('regression: api rate-limit responses keep the JSON error contract', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalVitestWorkerId = process.env.VITEST_WORKER_ID;
  const originalVitest = process.env.VITEST;

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }

    if (originalVitestWorkerId === undefined) {
      delete process.env.VITEST_WORKER_ID;
    } else {
      process.env.VITEST_WORKER_ID = originalVitestWorkerId;
    }

    if (originalVitest === undefined) {
      delete process.env.VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }
  });

  it('returns ApiError JSON when the API-specific limiter blocks an /api request', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VITEST_WORKER_ID;
    delete process.env.VITEST;

    const app = express();
    applyRateLimitingMiddleware(app);
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Exhaust the API-specific limiter (dev: 300 per minute).
    await Promise.all(Array.from({ length: 300 }, async () => {
      await request(app).get('/api/test');
    }));

    const response = await request(app).get('/api/test');

    expect(response.status).toBe(429);
    expect(response.headers['content-type']).toContain('application/json');
    expect(response.body).toMatchObject({
      error: 'Global rate limit exceeded',
      code: 'RATE_LIMITED',
    });
  });
});
