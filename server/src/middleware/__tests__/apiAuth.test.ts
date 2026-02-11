import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const { verifyIdTokenMock, loggerMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  loggerMock: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    auth: () => ({
      verifyIdToken: verifyIdTokenMock,
    }),
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: loggerMock,
}));

import { apiAuthMiddleware } from '../apiAuth';

type ApiAuthRequest = Request & {
  id?: string;
  apiKey?: string;
  user?: { uid: string };
  query: Request['query'] & { apiKey?: string };
};

function createRequest(overrides: Partial<ApiAuthRequest> = {}): ApiAuthRequest {
  const req = {
    headers: {},
    ip: '127.0.0.1',
    path: '/api/test',
    method: 'POST',
    id: 'req-1',
    query: {},
    get: vi.fn((name: string) => {
      const key = name.toLowerCase();
      const headers = req.headers as Record<string, string | undefined>;
      return headers[key];
    }),
    ...overrides,
  } as unknown as ApiAuthRequest;
  return req;
}

function createResponse() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('apiAuthMiddleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.ALLOWED_API_KEYS;
    delete process.env.API_KEY;
    delete process.env.NODE_ENV;
  });

  it('returns 401 when no authentication is provided', async () => {
    const req = createRequest();
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Authentication required',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when invalid credentials are provided', async () => {
    process.env.ALLOWED_API_KEYS = 'good-key';

    const req = createRequest({
      headers: { 'x-api-key': 'bad-key' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Unauthorized',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('authenticates with x-api-key header', async () => {
    process.env.ALLOWED_API_KEYS = 'k1,k2';
    const req = createRequest({
      headers: { 'x-api-key': 'k2' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(req.apiKey).toBe('k2');
    expect(req.user).toEqual({ uid: 'api-key:k2' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('authenticates with apiKey query parameter', async () => {
    process.env.API_KEY = 'query-key';
    const req = createRequest({
      query: { apiKey: 'query-key' } as ApiAuthRequest['query'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(req.apiKey).toBe('query-key');
    expect(req.user).toEqual({ uid: 'api-key:query-key' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('authenticates with bearer API key when Firebase token validation fails', async () => {
    process.env.ALLOWED_API_KEYS = 'bearer-key';
    verifyIdTokenMock.mockRejectedValue(new Error('invalid token'));

    const req = createRequest({
      headers: { authorization: 'Bearer bearer-key' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(verifyIdTokenMock).toHaveBeenCalledWith('bearer-key');
    expect(req.apiKey).toBe('bearer-key');
    expect(req.user).toEqual({ uid: 'api-key:bearer-key' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('authenticates with Firebase token', async () => {
    verifyIdTokenMock.mockResolvedValue({ uid: 'firebase-user' });
    const req = createRequest({
      headers: { 'x-firebase-token': 'firebase-token' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(verifyIdTokenMock).toHaveBeenCalledWith('firebase-token');
    expect(req.user).toEqual({ uid: 'firebase-user' });
    expect(req.apiKey).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to API key when Firebase verification fails', async () => {
    process.env.ALLOWED_API_KEYS = 'fallback-key';
    verifyIdTokenMock.mockRejectedValue(new Error('bad firebase token'));
    const req = createRequest({
      headers: {
        'x-firebase-token': 'bad-token',
        'x-api-key': 'fallback-key',
      } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(req.user).toEqual({ uid: 'api-key:fallback-key' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not allow the dev fallback key in production', async () => {
    process.env.NODE_ENV = 'production';
    const req = createRequest({
      headers: { 'x-api-key': 'dev-key-12345' } as Request['headers'],
    });
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await apiAuthMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
