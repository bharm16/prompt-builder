import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../requestId';

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'generated-uuid-1234',
}));

// Mock requestContext
vi.mock('@infrastructure/requestContext', () => ({
  runWithRequestContext: vi.fn((ctx, fn) => fn()),
}));

import { runWithRequestContext } from '@infrastructure/requestContext';

type RequestWithId = { headers: Record<string, string | string[] | undefined>; id?: string };

function createMockRequest(headers: Record<string, string | string[] | undefined> = {}): RequestWithId {
  return { headers } as RequestWithId;
}

function createMockResponse(): Response {
  return {
    setHeader: vi.fn(),
  } as unknown as Response;
}

describe('requestIdMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles missing x-request-id header by generating new ID', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('generated-uuid-1234');
    });

    it('handles empty string x-request-id header by generating new ID', () => {
      const req = createMockRequest({ 'x-request-id': '' });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('generated-uuid-1234');
    });

    it('handles undefined header by generating new ID', () => {
      const req = createMockRequest({ 'x-request-id': undefined });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('generated-uuid-1234');
    });
  });

  describe('edge cases', () => {
    it('uses first element when x-request-id is array', () => {
      const req = createMockRequest({ 'x-request-id': ['first-id', 'second-id'] });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('first-id');
    });

    it('generates ID when array contains empty strings', () => {
      const req = createMockRequest({ 'x-request-id': ['', 'second-id'] });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('generated-uuid-1234');
    });

    it('preserves provided ID with special characters', () => {
      const req = createMockRequest({ 'x-request-id': 'req-123_abc-xyz' });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('req-123_abc-xyz');
    });
  });

  describe('core behavior', () => {
    it('uses provided x-request-id header value', () => {
      const req = createMockRequest({ 'x-request-id': 'custom-request-id' });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(req.id).toBe('custom-request-id');
    });

    it('sets X-Request-ID response header', () => {
      const req = createMockRequest({ 'x-request-id': 'test-id' });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'test-id');
    });

    it('sets response header with generated ID when no header provided', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'generated-uuid-1234');
    });

    it('runs next within request context', () => {
      const req = createMockRequest({ 'x-request-id': 'ctx-test' });
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(runWithRequestContext).toHaveBeenCalledWith(
        { requestId: 'ctx-test' },
        expect.any(Function)
      );
      expect(next).toHaveBeenCalled();
    });

    it('calls next after setting up context', () => {
      const req = createMockRequest({});
      const res = createMockResponse();
      const next = vi.fn();

      requestIdMiddleware(req as never, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
