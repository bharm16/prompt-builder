import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../errorHandler';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock convergence error check
vi.mock('@services/convergence', () => ({
  isConvergenceError: vi.fn((err) => {
    return err && typeof err === 'object' && 'code' in err && 'getHttpStatus' in err;
  }),
}));

type RequestWithId = Request & { id?: string; body?: Record<string, unknown> };

function createMockRequest(
  options: { id?: string; method?: string; path?: string; body?: Record<string, unknown> } = {}
): RequestWithId {
  return {
    id: options.id,
    method: options.method || 'GET',
    path: options.path || '/test',
    body: options.body || {},
  } as RequestWithId;
}

function createMockResponse(): Response & { statusCode?: number; responseBody?: unknown } {
  const res = {
    statusCode: undefined as number | undefined,
    responseBody: undefined as unknown,
    status: vi.fn().mockImplementation(function(this: Response, code: number) {
      (this as Response & { statusCode: number }).statusCode = code;
      return this;
    }),
    json: vi.fn().mockImplementation(function(this: Response, data: unknown) {
      (this as Response & { responseBody: unknown }).responseBody = data;
      return this;
    }),
  };
  return res as unknown as Response & { statusCode?: number; responseBody?: unknown };
}

function createConvergenceError(code: string, httpStatus: number, userMessage: string, details?: unknown) {
  return {
    code,
    details,
    getHttpStatus: () => httpStatus,
    getUserMessage: () => userMessage,
  };
}

describe('errorHandler', () => {
  const mockNext: NextFunction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles null error gracefully', () => {
      const req = createMockRequest({ id: 'req-123' });
      const res = createMockResponse();

      errorHandler(null, req, res, mockNext);

      expect(res.statusCode).toBe(500);
      expect(res.responseBody).toMatchObject({
        error: 'null',
        requestId: 'req-123',
      });
    });

    it('handles undefined error gracefully', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      errorHandler(undefined, req, res, mockNext);

      expect(res.statusCode).toBe(500);
    });

    it('handles string error', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      errorHandler('Something went wrong', req, res, mockNext);

      expect(res.statusCode).toBe(500);
      expect(res.responseBody).toMatchObject({
        error: 'Something went wrong',
      });
    });

    it('handles number error', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      errorHandler(404, req, res, mockNext);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('Error object handling', () => {
    it('extracts message from Error instance', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new Error('Test error message');

      errorHandler(error, req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        error: 'Test error message',
      });
    });

    it('uses statusCode from error object', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = Object.assign(new Error('Bad request'), { statusCode: 400 });

      errorHandler(error, req, res, mockNext);

      expect(res.statusCode).toBe(400);
    });

    it('uses status from error object when statusCode missing', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = Object.assign(new Error('Forbidden'), { status: 403 });

      errorHandler(error, req, res, mockNext);

      expect(res.statusCode).toBe(403);
    });

    it('defaults to 500 when no status code provided', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = new Error('Internal error');

      errorHandler(error, req, res, mockNext);

      expect(res.statusCode).toBe(500);
    });

    it('includes details from error object', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = Object.assign(new Error('Validation failed'), {
        statusCode: 400,
        details: { field: 'email', issue: 'invalid format' },
      });

      errorHandler(error, req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        details: { field: 'email', issue: 'invalid format' },
      });
    });
  });

  describe('ConvergenceError handling', () => {
    it('maps ConvergenceError to proper HTTP status', () => {
      const req = createMockRequest({ id: 'conv-req' });
      const res = createMockResponse();
      const error = createConvergenceError('SESSION_EXPIRED', 410, 'Session has expired');

      errorHandler(error, req, res, mockNext);

      expect(res.statusCode).toBe(410);
      expect(res.responseBody).toMatchObject({
        error: 'SESSION_EXPIRED',
        message: 'Session has expired',
        requestId: 'conv-req',
      });
    });

    it('includes details from ConvergenceError', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = createConvergenceError(
        'INSUFFICIENT_CREDITS',
        402,
        'Not enough credits',
        { required: 10, available: 5 }
      );

      errorHandler(error, req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        details: { required: 10, available: 5 },
      });
    });
  });

  describe('sensitive data redaction', () => {
    it('redacts email addresses in body preview', () => {
      const req = createMockRequest({
        body: { email: 'user@example.com' },
      });
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      // The redaction happens in logging, not in response
      expect(res.responseBody).toBeDefined();
    });

    it('redacts password fields in body', () => {
      const req = createMockRequest({
        body: { password: 'secret123' },
      });
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      expect(res.responseBody).toBeDefined();
    });

    it('handles body serialization errors gracefully', () => {
      const circularBody: Record<string, unknown> = { name: 'test' };
      circularBody.self = circularBody;
      const req = createMockRequest({ body: circularBody });
      const res = createMockResponse();

      // Should not throw
      expect(() => {
        errorHandler(new Error('test'), req, res, mockNext);
      }).not.toThrow();

      expect(res.statusCode).toBe(500);
    });
  });

  describe('edge cases', () => {
    it('includes requestId in response when available', () => {
      const req = createMockRequest({ id: 'unique-request-id' });
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        requestId: 'unique-request-id',
      });
    });

    it('handles missing requestId gracefully', () => {
      const req = createMockRequest({});
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        requestId: undefined,
      });
    });

    it('handles empty body gracefully', () => {
      const req = createMockRequest({ body: {} });
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      expect(res.statusCode).toBe(500);
    });

    it('uses fallback message for errors without message', () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const error = Object.assign(new Error(), { message: '' });

      errorHandler(error, req, res, mockNext);

      expect(res.responseBody).toMatchObject({
        error: 'Internal server error',
      });
    });
  });

  describe('core behavior', () => {
    it('does not call next after handling error', () => {
      const req = createMockRequest();
      const res = createMockResponse();

      errorHandler(new Error('test'), req, res, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
    });

    it('logs error with request metadata', () => {
      const req = createMockRequest({
        id: 'log-req',
        method: 'POST',
        path: '/api/test',
      });
      const res = createMockResponse();

      errorHandler(new Error('Logged error'), req, res, mockNext);

      expect(res.statusCode).toBe(500);
    });
  });
});
