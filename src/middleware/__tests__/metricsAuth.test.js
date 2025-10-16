import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { metricsAuthMiddleware } from '../metricsAuth.js';

vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

describe('metricsAuthMiddleware', () => {
  const prev = process.env.METRICS_TOKEN;
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env.METRICS_TOKEN = prev; });

  it('rejects missing Authorization header', () => {
    process.env.METRICS_TOKEN = 'tok';
    const req = { headers: {}, id: 'm1', ip: '::1', path: '/metrics' };
    const res = makeRes();
    const next = vi.fn();
    metricsAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Authorization required');
  });

  it('rejects invalid bearer format', () => {
    process.env.METRICS_TOKEN = 'tok';
    const req = { headers: { authorization: 'Token abc' }, id: 'm2', ip: '::1', path: '/metrics' };
    const res = makeRes();
    const next = vi.fn();
    metricsAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid authorization format');
  });

  it('returns 500 when METRICS_TOKEN not configured', () => {
    process.env.METRICS_TOKEN = '';
    const req = { headers: { authorization: 'Bearer abc' }, id: 'm3', ip: '::1', path: '/metrics' };
    const res = makeRes();
    const next = vi.fn();
    metricsAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Server configuration error');
  });

  it('rejects invalid token and accepts valid token', () => {
    process.env.METRICS_TOKEN = 'secret-token';
    const badReq = { headers: { authorization: 'Bearer nope' }, id: 'm4', ip: '::1', path: '/metrics' };
    const badRes = makeRes();
    const next = vi.fn();
    metricsAuthMiddleware(badReq, badRes, next);
    expect(badRes.statusCode).toBe(403);

    const goodReq = { headers: { authorization: 'Bearer secret-token' }, id: 'm5', ip: '::1', path: '/metrics' };
    const goodRes = makeRes();
    const next2 = vi.fn();
    metricsAuthMiddleware(goodReq, goodRes, next2);
    expect(next2).toHaveBeenCalled();
  });
});

