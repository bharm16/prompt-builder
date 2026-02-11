import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { RequestCoalescingMiddleware } from '../requestCoalescing';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

type TestRequest = Request & {
  id?: string;
  body?: unknown;
};

type EventMap = Record<string, (arg?: unknown) => void>;
type TestResponse = Response & {
  emit?: (event: string, arg?: unknown) => void;
};

function createRequest(overrides: Partial<TestRequest> = {}): TestRequest {
  return {
    method: 'POST',
    path: '/api/test',
    body: { prompt: 'hello' },
    id: 'req-1',
    get: vi.fn((name: string) => {
      if (name.toLowerCase() === 'authorization') return 'Bearer token';
      return undefined;
    }),
    ...overrides,
  } as unknown as TestRequest;
}

function createResponse(): TestResponse {
  const events: EventMap = {};
  const res = {
    json: vi.fn().mockReturnThis(),
    on: vi.fn((event: string, cb: (arg?: unknown) => void) => {
      events[event] = cb;
      return res;
    }),
    emit: (event: string, arg?: unknown) => events[event]?.(arg),
  };
  return res as unknown as TestResponse;
}

describe('RequestCoalescingMiddleware', () => {
  let service: RequestCoalescingMiddleware;

  beforeEach(() => {
    service = new RequestCoalescingMiddleware();
  });

  afterEach(() => {
    service.clear();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('bypasses non-POST requests', async () => {
    const middleware = service.middleware();
    const req = createRequest({ method: 'GET' });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(service.getStats().total).toBe(0);
  });

  it('bypasses non-API routes', async () => {
    const middleware = service.middleware();
    const req = createRequest({ path: '/health' });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(service.getStats().total).toBe(0);
  });

  it('deduplicates concurrent identical requests', async () => {
    vi.useFakeTimers();
    const middleware = service.middleware();
    const req1 = createRequest({ id: 'req-1' });
    const req2 = createRequest({ id: 'req-2' });
    const res1 = createResponse();
    const res2 = createResponse();

    const next1 = vi.fn(() => {
      setTimeout(() => {
        res1.json({ ok: true, value: 42 });
      }, 10);
    }) as NextFunction;
    const next2 = vi.fn() as NextFunction;

    const p1 = middleware(req1, res1, next1);
    const p2 = middleware(req2, res2, next2);

    await vi.advanceTimersByTimeAsync(10);
    await Promise.all([p1, p2]);

    expect(next1).toHaveBeenCalledTimes(1);
    expect(next2).not.toHaveBeenCalled();
    expect(res2.json).toHaveBeenCalledWith({ ok: true, value: 42 });

    const stats = service.getStats();
    expect(stats.unique).toBe(1);
    expect(stats.coalesced).toBe(1);
    expect(stats.activePending).toBe(1);
  });

  it('propagates upstream error to coalesced request', async () => {
    vi.useFakeTimers();
    const middleware = service.middleware();
    const req1 = createRequest({ id: 'req-1' });
    const req2 = createRequest({ id: 'req-2' });
    const res1 = createResponse();
    const res2 = createResponse();
    const error = new Error('upstream failed');

    const next1 = vi.fn(() => {
      setTimeout(() => {
        res1.emit?.('error', error);
      }, 5);
    }) as NextFunction;
    const next2 = vi.fn() as NextFunction;

    await middleware(req1, res1, next1);
    const p2 = middleware(req2, res2, next2);

    await vi.advanceTimersByTimeAsync(5);
    await p2;

    expect(next2).toHaveBeenCalledWith(error);
  });

  it('cleans completed entries after coalescing window', async () => {
    vi.useFakeTimers();
    const middleware = service.middleware();
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn(() => {
      res.json({ ok: true });
    }) as NextFunction;

    await middleware(req, res, next);
    expect(service.getStats().activePending).toBe(1);

    await vi.advanceTimersByTimeAsync(250);
    expect(service.getStats().activePending).toBe(0);
  });

  it('generates deterministic keys and hashes large payloads', () => {
    const reqA = createRequest({
      body: { foo: 'bar', nested: { a: 1 } },
    });
    const reqB = createRequest({
      body: { foo: 'bar', nested: { a: 1 } },
    });
    const smallKeyA = service.generateKey(reqA);
    const smallKeyB = service.generateKey(reqB);
    expect(smallKeyA).toBe(smallKeyB);
    expect(smallKeyA).toContain('/api/test');

    const bigBody = { text: 'x'.repeat(600) };
    const reqBig = createRequest({ body: bigBody });
    const bigKey = service.generateKey(reqBig);
    expect(bigKey).toMatch(/^POST:\/api\/test:Bearer token:[a-f0-9]{16}$/);
  });
});
