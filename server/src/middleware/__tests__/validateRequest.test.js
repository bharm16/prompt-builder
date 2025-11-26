import { describe, it, expect, vi } from 'vitest';
import { validateRequest } from '../validateRequest.js';
import Joi from 'joi';
import { z } from 'zod';

vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
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
  describe('Joi schemas', () => {
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

  describe('Zod schemas', () => {
    const schema = z.object({ 
      name: z.string().min(1, 'Name is required'),
      age: z.number().optional(),
    });

    it('passes valid request and sanitizes body', () => {
      const req = { body: { name: 'ok', age: 25 }, id: 'v3', path: '/x' };
      const res = makeRes();
      const next = vi.fn();
      validateRequest(schema)(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.body).toHaveProperty('name', 'ok');
      expect(req.body).toHaveProperty('age', 25);
    });

    it('rejects invalid request with 400 and details', () => {
      const req = { body: {}, id: 'v4', path: '/x' };
      const res = makeRes();
      const next = vi.fn();
      validateRequest(schema)(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });

    it('rejects request with invalid types', () => {
      const req = { body: { name: 123 }, id: 'v5', path: '/x' };
      const res = makeRes();
      const next = vi.fn();
      validateRequest(schema)(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('Invalid schema', () => {
    it('returns 500 for invalid schema', () => {
      const req = { body: { name: 'ok' }, id: 'v6', path: '/x' };
      const res = makeRes();
      const next = vi.fn();
      validateRequest(null)(req, res, next);
      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Internal server error');
      expect(next).not.toHaveBeenCalled();
    });
  });
});
