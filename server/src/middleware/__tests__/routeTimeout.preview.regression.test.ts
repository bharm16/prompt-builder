import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRouteTimeout } from '../routeTimeout';

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

describe('regression: preview routes are not timed out by generic /api timeout middleware', () => {
  it('excludes /api/preview/* while still enforcing timeout for other /api routes', async () => {
    const app = express();
    const apiRouter = express.Router();

    apiRouter.get('/slow', async (_req, res) => {
      await wait(40);
      if (!res.headersSent) {
        res.json({ ok: true });
      }
    });

    app.use(
      '/api',
      createRouteTimeout(20, {
        shouldApply: (req) => !(req.path === '/preview' || req.path.startsWith('/preview/')),
      }),
      apiRouter
    );

    app.get('/api/preview/slow', async (_req, res) => {
      await wait(40);
      res.json({ ok: true });
    });

    const timedOutResponse = await request(app).get('/api/slow');
    expect(timedOutResponse.status).toBe(504);
    expect(timedOutResponse.body).toEqual(
      expect.objectContaining({
        error: 'Request timeout',
        code: 'ROUTE_TIMEOUT',
      })
    );

    const previewResponse = await request(app).get('/api/preview/slow');
    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body).toEqual({ ok: true });
  });
});
