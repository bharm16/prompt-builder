import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import { applyRateLimitingMiddleware } from '../middleware.config';

describe('regression: asset-view routes are exempt from the general rate limiter', () => {
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

  it('asset-view requests do not count against the general rate limiter budget', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.VITEST_WORKER_ID;
    delete process.env.VITEST;

    const app = express();
    applyRateLimitingMiddleware(app);

    // Mount dummy handlers — use a non-/api/ path for general-budget requests
    // to avoid also hitting the API-specific limiter (which has a lower cap).
    app.post('/api/preview/image/view-batch', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/api/preview/image/view', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/general-test', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    // Without Redis the general limit is 500/4 = 125.
    // Fire 124 requests to a non-/api/ route to nearly exhaust the general budget.
    for (let i = 0; i < 124; i++) {
      const response = await request(app).get('/general-test');
      expect(response.status).toBe(200);
    }

    // Fire many asset-view requests — these must NOT exhaust the general limiter.
    for (let i = 0; i < 50; i++) {
      const batchRes = await request(app)
        .post('/api/preview/image/view-batch')
        .send({ assetIds: [] });
      expect(batchRes.status).toBe(200);
    }

    for (let i = 0; i < 50; i++) {
      const viewRes = await request(app).get('/api/preview/image/view');
      expect(viewRes.status).toBe(200);
    }

    // The general budget should still have 1 remaining — this must succeed.
    const finalRes = await request(app).get('/general-test');
    expect(finalRes.status).toBe(200);
  });
});
