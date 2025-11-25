import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestCoalescingMiddleware } from '../requestCoalescing.js';

vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RequestCoalescingMiddleware', () => {
  let middleware;
  let req, res, next;

  beforeEach(() => {
    middleware = new RequestCoalescingMiddleware();

    req = {
      method: 'POST',
      path: '/api/test',
      body: { test: 'data' },
      get: vi.fn().mockReturnValue(null),
      id: 'test-request-id',
    };

    res = {
      json: vi.fn(),
      on: vi.fn(),
    };

    next = vi.fn();
    vi.clearAllMocks();
  });

  describe('generateKey', () => {
    it('should generate consistent keys for identical requests', () => {
      const key1 = middleware.generateKey(req);
      const key2 = middleware.generateKey(req);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different requests', () => {
      const key1 = middleware.generateKey(req);
      req.body = { different: 'data' };
      const key2 = middleware.generateKey(req);

      expect(key1).not.toBe(key2);
    });

    it('should include method in key', () => {
      const key1 = middleware.generateKey(req);
      req.method = 'GET';
      const key2 = middleware.generateKey(req);

      expect(key1).not.toBe(key2);
    });

    it('should include path in key', () => {
      const key1 = middleware.generateKey(req);
      req.path = '/api/different';
      const key2 = middleware.generateKey(req);

      expect(key1).not.toBe(key2);
    });
  });

  describe('middleware', () => {
    it('should call next for non-POST requests', async () => {
      req.method = 'GET';
      const mw = middleware.middleware();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should call next for non-API routes', async () => {
      req.path = '/public/index.html';
      const mw = middleware.middleware();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should process unique requests normally', async () => {
      const mw = middleware.middleware();

      await mw(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(middleware.stats.unique).toBe(1);
    });

    it('should coalesce identical concurrent requests', async () => {
      const mw = middleware.middleware();
      const req2 = { ...req, id: 'test-request-id-2' };
      const res2 = { json: vi.fn(), on: vi.fn() };

      // Start first request
      const promise1 = mw(req, res, next);

      // Start identical second request before first completes
      const promise2 = mw(req2, res2, next);

      // Complete first request
      res.json({ result: 'test' });

      await promise1;
      await promise2;

      expect(middleware.stats.coalesced).toBe(1);
      expect(res2.json).toHaveBeenCalledWith({ result: 'test' });
    });

    it('should clean up pending requests after delay', async () => {
      const mw = middleware.middleware();

      await mw(req, res, next);
      res.json({ result: 'test' });

      expect(middleware.pendingRequests.size).toBe(1);

      await new Promise(resolve => setTimeout(resolve, 150));

      expect(middleware.pendingRequests.size).toBe(0);
    });
  });

  describe('getStats', () => {
    it('should return statistics', () => {
      const stats = middleware.getStats();

      expect(stats).toHaveProperty('coalesced');
      expect(stats).toHaveProperty('unique');
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('coalescingRate');
    });

    it('should calculate coalescing rate correctly', () => {
      middleware.stats.unique = 10;
      middleware.stats.coalesced = 5;

      const stats = middleware.getStats();

      expect(stats.total).toBe(15);
      expect(stats.coalescingRate).toBe('33.33%');
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', () => {
      middleware.stats.coalesced = 10;
      middleware.stats.unique = 20;

      middleware.resetStats();

      expect(middleware.stats.coalesced).toBe(0);
      expect(middleware.stats.unique).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear pending requests', () => {
      middleware.pendingRequests.set('test', Promise.resolve());

      middleware.clear();

      expect(middleware.pendingRequests.size).toBe(0);
    });
  });
});
