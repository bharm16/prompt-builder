import { describe, it, expect, vi } from 'vitest';
import { validateRequest } from '../validateRequest.js';
import Joi from 'joi';

vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: { warn: vi.fn() },
}));

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; return this; },
  };
}

describe('validateRequest', () => {
  const schema = Joi.object({ name: Joi.string().required() }).unknown(true);

  it('passes valid request and sanitizes body', () => {
    const req = { body: { name: 'ok', extra: 'x' }, id: 'v1', path: '/x' };
    const res = makeRes();
    const next = vi.fn();
    validateRequest(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toHaveProperty('name', 'ok');
  });

  it('rejects invalid request with 400 and details', () => {
    const req = { body: {}, id: 'v2', path: '/x' };
    const res = makeRes();
    const next = vi.fn();
    validateRequest(schema)(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});
