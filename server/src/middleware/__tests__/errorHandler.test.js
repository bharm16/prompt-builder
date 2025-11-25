import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { errorHandler } from '../errorHandler.js';

vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: {
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

describe('errorHandler', () => {
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = prevEnv; });

  it('includes stack in development and omits in production', () => {
    const req = { id: 'e1', method: 'GET', path: '/x', body: {} };
    const res = makeRes();
    const err = new Error('boom');

    process.env.NODE_ENV = 'development';
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('boom');
    expect(res.body.stack).toBeDefined();

    const res2 = makeRes();
    process.env.NODE_ENV = 'production';
    errorHandler(err, req, res2, () => {});
    expect(res2.body.stack).toBeUndefined();
  });

  it('uses provided statusCode on error', () => {
    const req = { id: 'e2', method: 'POST', path: '/x', body: {} };
    const res = makeRes();
    const err = new Error('bad');
    err.statusCode = 400;
    errorHandler(err, req, res, () => {});
    expect(res.statusCode).toBe(400);
  });
});

