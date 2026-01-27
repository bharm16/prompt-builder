import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import { validateRequest } from '../validateRequest';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function createMockRequest(body: unknown = {}, id?: string): Request & { id?: string } {
  return { body, path: '/test', id } as Request & { id?: string };
}

function createMockResponse(): Response & { statusCode?: number; body?: unknown } {
  const res = {
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status: vi.fn().mockImplementation(function(this: Response, code: number) {
      (this as Response & { statusCode: number }).statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function(this: Response, data: unknown) {
      (this as Response & { body: unknown }).body = data;
      return this;
    }),
  };
  return res as unknown as Response & { statusCode?: number; body?: unknown };
}

// Mock Zod-like schema
function createZodSchema(validateFn: (value: unknown) => { success: boolean; error?: { errors: Array<{ message: string }> }; data: unknown }) {
  return { safeParse: validateFn };
}

// Mock Joi-like schema
function createJoiSchema(validateFn: (value: unknown, options?: unknown) => { error?: { details: Array<{ message: string }> }; value: unknown }) {
  return { validate: validateFn };
}

describe('validateRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('returns 500 for invalid schema type', () => {
      const invalidSchema = { notAValidSchema: true };
      const middleware = validateRequest(invalidSchema as never);
      const req = createMockRequest({ test: true });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(500);
      expect(res.body).toMatchObject({
        error: 'Internal server error',
        message: 'Invalid validation schema',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 500 for null schema', () => {
      const middleware = validateRequest(null as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(500);
    });

    it('returns 500 for undefined schema', () => {
      const middleware = validateRequest(undefined as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('Zod schema validation', () => {
    it('returns 400 when Zod validation fails', () => {
      const zodSchema = createZodSchema(() => ({
        success: false,
        error: { errors: [{ message: 'Invalid email format' }] },
        data: undefined,
      }));
      const middleware = validateRequest(zodSchema as never);
      const req = createMockRequest({ email: 'invalid' }, 'req-123');
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Validation failed',
        details: 'Invalid email format',
        requestId: 'req-123',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 with fallback message when Zod error has no details', () => {
      const zodSchema = createZodSchema(() => ({
        success: false,
        error: { errors: [] },
        data: undefined,
      }));
      const middleware = validateRequest(zodSchema as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.body).toMatchObject({
        details: 'Invalid request data',
      });
    });

    it('calls next and replaces body with validated data on success', () => {
      const validatedData = { email: 'valid@test.com', normalized: true };
      const zodSchema = createZodSchema(() => ({
        success: true,
        data: validatedData,
      }));
      const middleware = validateRequest(zodSchema as never);
      const req = createMockRequest({ email: 'VALID@TEST.COM' });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(req.body).toEqual(validatedData);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('Joi schema validation', () => {
    it('returns 400 when Joi validation fails', () => {
      const joiSchema = createJoiSchema(() => ({
        error: { details: [{ message: '"name" is required' }] },
        value: undefined,
      }));
      const middleware = validateRequest(joiSchema as never);
      const req = createMockRequest({}, 'req-456');
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body).toMatchObject({
        error: 'Validation failed',
        details: '"name" is required',
        requestId: 'req-456',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 with fallback message when Joi error has no details', () => {
      const joiSchema = createJoiSchema(() => ({
        error: { details: [] },
        value: undefined,
      }));
      const middleware = validateRequest(joiSchema as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.body).toMatchObject({
        details: 'Invalid request data',
      });
    });

    it('calls next and replaces body with validated value on success', () => {
      const validatedValue = { name: 'Test', trimmed: true };
      const joiSchema = createJoiSchema(() => ({
        error: undefined,
        value: validatedValue,
      }));
      const middleware = validateRequest(joiSchema as never);
      const req = createMockRequest({ name: '  Test  ' });
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(req.body).toEqual(validatedValue);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('includes requestId in error response when available', () => {
      const zodSchema = createZodSchema(() => ({
        success: false,
        error: { errors: [{ message: 'error' }] },
        data: undefined,
      }));
      const middleware = validateRequest(zodSchema as never);
      const req = createMockRequest({}, 'custom-request-id');
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.body).toMatchObject({
        requestId: 'custom-request-id',
      });
    });

    it('handles missing requestId gracefully', () => {
      const zodSchema = createZodSchema(() => ({
        success: false,
        error: { errors: [{ message: 'error' }] },
        data: undefined,
      }));
      const middleware = validateRequest(zodSchema as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(res.body).toMatchObject({
        requestId: undefined,
      });
    });
  });

  describe('core behavior', () => {
    it('prefers Zod schema over Joi when both methods exist', () => {
      const schema = {
        safeParse: vi.fn().mockReturnValue({ success: true, data: { zod: true } }),
        validate: vi.fn().mockReturnValue({ value: { joi: true } }),
      };
      const middleware = validateRequest(schema as never);
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req, res, next);

      expect(schema.safeParse).toHaveBeenCalled();
      expect(schema.validate).not.toHaveBeenCalled();
      expect(req.body).toEqual({ zod: true });
    });
  });
});
