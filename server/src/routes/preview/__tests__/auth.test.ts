import type { Request } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { verifyIdTokenMock, extractFirebaseTokenMock } = vi.hoisted(() => ({
  verifyIdTokenMock: vi.fn(),
  extractFirebaseTokenMock: vi.fn(),
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  admin: {
    auth: () => ({
      verifyIdToken: verifyIdTokenMock,
    }),
  },
}));

vi.mock('@utils/auth', () => ({
  extractFirebaseToken: extractFirebaseTokenMock,
}));

import { getAuthenticatedUserId } from '../auth';

const buildRequest = (overrides: Partial<Request> = {}): Request =>
  ({
    path: '/preview/generate',
    ip: '127.0.0.1',
    headers: {},
    ...overrides,
  }) as Request;

describe('preview auth', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns dev api key identity in non-production environments', async () => {
    process.env.NODE_ENV = 'development';
    const req = buildRequest({ apiKey: 'dev-key-123' } as unknown as Partial<Request>);

    const userId = await getAuthenticatedUserId(req);

    expect(userId).toBe('dev-api-key:dev-key-123');
    expect(extractFirebaseTokenMock).not.toHaveBeenCalled();
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it('returns null when authentication token is missing', async () => {
    extractFirebaseTokenMock.mockReturnValueOnce(null);
    const req = buildRequest();

    const userId = await getAuthenticatedUserId(req);

    expect(userId).toBeNull();
    expect(verifyIdTokenMock).not.toHaveBeenCalled();
  });

  it('returns null when token verification fails', async () => {
    extractFirebaseTokenMock.mockReturnValueOnce('firebase-token');
    verifyIdTokenMock.mockRejectedValueOnce(new Error('invalid token'));
    const req = buildRequest();

    const userId = await getAuthenticatedUserId(req);

    expect(userId).toBeNull();
    expect(verifyIdTokenMock).toHaveBeenCalledWith('firebase-token');
  });

  it('returns uid and mutates request.user when token verification succeeds', async () => {
    extractFirebaseTokenMock.mockReturnValueOnce('firebase-token');
    verifyIdTokenMock.mockResolvedValueOnce({ uid: 'uid-123' });
    const req = buildRequest();

    const userId = await getAuthenticatedUserId(req);

    expect(userId).toBe('uid-123');
    expect((req as Request & { user?: { uid?: string } }).user).toEqual({ uid: 'uid-123' });
  });
});
