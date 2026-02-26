import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../asyncHandler';

function createMockRequest(): Request {
  return {} as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

describe('asyncHandler', () => {
  describe('error handling', () => {
    it('passes rejected promise error to next', async () => {
      const error = new Error('async failure');
      const handler = asyncHandler(async () => {
        throw error;
      });
      const next = vi.fn();

      await handler(createMockRequest(), createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });

    it('passes synchronous thrown errors to next', () => {
      const error = new Error('sync failure');
      const handler = asyncHandler(() => {
        throw error;
      });
      const next = vi.fn();

      expect(() => handler(createMockRequest(), createMockResponse(), next)).not.toThrow();
      expect(next).toHaveBeenCalledWith(error);
    });

    it('passes non-Error thrown value to next', async () => {
      const handler = asyncHandler(async () => {
        throw 'string error';
      });
      const next = vi.fn();

      await handler(createMockRequest(), createMockResponse(), next);

      expect(next).toHaveBeenCalledWith('string error');
    });

    it('handles promise rejection with undefined', async () => {
      const handler = asyncHandler(async () => {
        // eslint-disable-next-line prefer-promise-reject-errors
        throw undefined;
      });
      const next = vi.fn();

      // Wait for the rejection to be processed
      await new Promise((resolve) => {
        next.mockImplementation(() => resolve(undefined));
        handler(createMockRequest(), createMockResponse(), next);
      });

      expect(next).toHaveBeenCalledWith(undefined);
    });
  });

  describe('edge cases', () => {
    it('handles handler that returns undefined', async () => {
      const handler = asyncHandler(async () => undefined);
      const next = vi.fn();

      await handler(createMockRequest(), createMockResponse(), next);

      expect(next).not.toHaveBeenCalled();
    });

    it('handles synchronous handler that returns value', async () => {
      const handler = asyncHandler(() => 'sync result');
      const next = vi.fn();

      await handler(createMockRequest(), createMockResponse(), next);

      expect(next).not.toHaveBeenCalled();
    });

    it('handles handler that calls next explicitly', async () => {
      const handler = asyncHandler(async (_req, _res, next) => {
        next();
      });
      const next = vi.fn();

      await handler(createMockRequest(), createMockResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('core behavior', () => {
    it('passes request, response, and next to handler', async () => {
      const req = createMockRequest();
      const res = createMockResponse();
      const next = vi.fn();
      const handlerFn = vi.fn().mockResolvedValue(undefined);

      const handler = asyncHandler(handlerFn);
      await handler(req, res, next);

      expect(handlerFn).toHaveBeenCalledWith(req, res, next);
    });

    it('returns a function that matches RequestHandler signature', () => {
      const handler = asyncHandler(async () => {});

      expect(typeof handler).toBe('function');
      expect(handler.length).toBe(3); // req, res, next
    });

    it('allows handler to send response without calling next', async () => {
      const mockRes = {
        json: vi.fn(),
        status: vi.fn().mockReturnThis(),
      } as unknown as Response;
      const handler = asyncHandler(async (_req, res) => {
        res.status(200).json({ success: true });
      });
      const next = vi.fn();

      await handler(createMockRequest(), mockRes, next);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
