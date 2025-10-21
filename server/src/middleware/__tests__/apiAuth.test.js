import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiAuthMiddleware } from '../apiAuth.js';

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

describe('apiAuthMiddleware', () => {
  const prev = process.env.ALLOWED_API_KEYS;
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { process.env.ALLOWED_API_KEYS = prev; });

  it('returns 401 when API key missing', () => {
    process.env.ALLOWED_API_KEYS = 'dev-key-12345';
    const req = { headers: {}, query: {}, id: 'r1', ip: '::1', path: '/api/x', method: 'POST' };
    const res = makeRes();
    const next = vi.fn();
    apiAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('API key required');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 when ALLOWED_API_KEYS not set', () => {
    delete process.env.ALLOWED_API_KEYS;
    const req = { headers: { 'x-api-key': 'a' }, query: {}, id: 'r2', ip: '::1', path: '/api/x', method: 'POST' };
    const res = makeRes();
    const next = vi.fn();
    apiAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Server configuration error');
  });

  it('returns 403 when key invalid', () => {
    process.env.ALLOWED_API_KEYS = 'valid';
    const req = { headers: { 'x-api-key': 'invalid' }, query: {}, id: 'r3', ip: '::1', path: '/api/x', method: 'POST' };
    const res = makeRes();
    const next = vi.fn();
    apiAuthMiddleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe('Invalid API key');
  });

  it('accepts valid key from header and rejects query param', () => {
    process.env.ALLOWED_API_KEYS = 'valid1,valid2';
    const res = makeRes();
    const next = vi.fn();
    apiAuthMiddleware({ headers: { 'x-api-key': 'valid1' }, query: {}, id: 'r4', ip: '::1', path: '/api/x', method: 'GET' }, res, next);
    expect(next).toHaveBeenCalled();

    const res2 = makeRes();
    const next2 = vi.fn();
    apiAuthMiddleware({ headers: {}, query: { apiKey: 'valid2' }, id: 'r5', ip: '::1', path: '/api/x', method: 'GET' }, res2, next2);
    expect(res2.statusCode).toBe(401);
    expect(next2).not.toHaveBeenCalled();
  });
});
