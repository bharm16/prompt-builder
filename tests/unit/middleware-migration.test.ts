import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('uuid', () => ({
  v4: () => 'uuid-fixed',
}));

import { logger } from '@infrastructure/Logger';
import { runWithRequestContext, getRequestContext } from '@infrastructure/requestContext';
import { requestIdMiddleware } from '@middleware/requestId';
import { asyncHandler } from '@middleware/asyncHandler';
import { errorHandler } from '@middleware/errorHandler';
import { PerformanceMonitor } from '@middleware/performanceMonitor';

const mockedLogger = vi.mocked(logger);

describe('requestContext', () => {
  it('stores and retrieves request context within AsyncLocalStorage scope', () => {
    const result = runWithRequestContext({ requestId: 'req-123' }, () => {
      return getRequestContext();
    });

    expect(result).toEqual({ requestId: 'req-123' });
  });
});

describe('requestIdMiddleware', () => {
  it('uses provided request id and exposes it via context', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (req, res) => {
      res.json({
        id: req.id,
        context: getRequestContext(),
      });
    });

    const response = await request(app)
      .get('/test')
      .set('x-request-id', 'incoming-id');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('incoming-id');
    expect(response.body.id).toBe('incoming-id');
    expect(response.body.context).toEqual({ requestId: 'incoming-id' });
  });

  it('generates a request id when none is provided', async () => {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (req, res) => {
      res.json({ id: req.id });
    });

    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe('uuid-fixed');
    expect(response.body.id).toBe('uuid-fixed');
  });
});

describe('asyncHandler', () => {
  it('forwards async errors to next middleware', async () => {
    const app = express();
    app.get(
      '/boom',
      asyncHandler(async () => {
        throw new Error('boom');
      })
    );

    app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: err.message });
    });

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('boom');
  });
});

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.clearAllMocks();
  });

  it('responds with redacted error payload and logs safely', async () => {
    const app = express();
    app.use(express.json());
    app.use(requestIdMiddleware);

    app.post('/fail', (req, _res, next) => {
      const err = Object.assign(new Error('failure'), {
        statusCode: 418,
        details: { reason: 'teapot' },
      });
      next(err);
    });

    app.use(errorHandler);

    const response = await request(app)
      .post('/fail')
      .send({ email: 'user@example.com', message: 'hello' });

    expect(response.status).toBe(418);
    expect(response.body.error).toBe('failure');
    expect(response.body.requestId).toBe('uuid-fixed');
    expect(response.body.details).toEqual({ reason: 'teapot' });
    expect(response.body.stack).toContain('Error: failure');

    expect(mockedLogger.error).toHaveBeenCalled();
    const meta = mockedLogger.error.mock.calls[0]?.[2] as { bodyPreview?: string };
    expect(meta.bodyPreview).toContain('[REDACTED]');
  });
});

describe('PerformanceMonitor', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('adds response time header and records metrics', async () => {
    const app = express();
    const monitor = new PerformanceMonitor();

    app.use((req, res, next) => monitor.trackRequest(req, res, next));
    app.get('/ok', (req, res) => {
      req.perfMonitor?.start('work');
      req.perfMonitor?.end('work');
      res.json({ ok: true });
    });

    const response = await request(app).get('/ok');

    expect(response.status).toBe(200);
    expect(response.headers['x-response-time']).toMatch(/\d+ms/);
    expect(mockedLogger.info).toHaveBeenCalled();
  });

  it('alerts on slow requests in production', async () => {
    process.env.NODE_ENV = 'production';
    const metricsService = { recordAlert: vi.fn() };
    const monitor = new PerformanceMonitor(metricsService);
    const app = express();

    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);

    app.use((req, res, next) => monitor.trackRequest(req, res, next));
    app.get('/slow', (_req, res) => {
      now = 2501;
      res.json({ ok: true });
    });

    const response = await request(app).get('/slow');

    expect(response.status).toBe(200);
    expect(metricsService.recordAlert).toHaveBeenCalledWith('request_latency_exceeded', {
      route: '/slow',
      total: 2501,
      threshold: 2000,
    });
  });
});
