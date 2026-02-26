import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  extractFirebaseToken: vi.fn(),
  verifyIdToken: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@utils/auth', () => ({
  extractFirebaseToken: mocks.extractFirebaseToken,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

vi.mock('@infrastructure/firebaseAdmin', () => ({
  getAuth: () => ({
    verifyIdToken: mocks.verifyIdToken,
  }),
}));

import { resolveUserId } from '@routes/payment/auth';

describe('resolveUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers authenticated req.user uid when present', async () => {
    const req = {
      path: '/api/payment/checkout',
      user: { uid: 'user-from-req' },
      body: {},
    };

    await expect(resolveUserId(req as any)).resolves.toBe('user-from-req');
    expect(mocks.extractFirebaseToken).not.toHaveBeenCalled();
  });

  it('verifies Firebase token and populates req.user when token is valid', async () => {
    const req: Record<string, unknown> = {
      path: '/api/payment/checkout',
      body: {},
    };
    mocks.extractFirebaseToken.mockReturnValue('token-123');
    mocks.verifyIdToken.mockResolvedValue({ uid: 'user-from-token' });

    const result = await resolveUserId(req as any);

    expect(result).toBe('user-from-token');
    expect(req.user).toEqual({ uid: 'user-from-token' });
  });

  it('does not trust body.userId — prevents IDOR via request body', async () => {
    const req = {
      path: '/api/payment/checkout',
      body: { userId: 'victim-uid' },
    };
    mocks.extractFirebaseToken.mockReturnValue(null);

    const result = await resolveUserId(req as any);

    expect(result).toBeNull();
  });

  it('does not fall back to body.userId when token verification fails', async () => {
    const req = {
      path: '/api/payment/checkout',
      body: { userId: 'victim-uid' },
    };
    mocks.extractFirebaseToken.mockReturnValue('token-123');
    mocks.verifyIdToken.mockRejectedValue(new Error('bad token'));

    const result = await resolveUserId(req as any);

    expect(result).toBeNull();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Failed to verify auth token for payment request',
      expect.objectContaining({
        path: '/api/payment/checkout',
        error: 'bad token',
      })
    );
  });

  it('falls back to apiKey when no auth user or token exists', async () => {
    const req = {
      path: '/api/payment/checkout',
      body: {},
      apiKey: 'api-user-1',
    };
    mocks.extractFirebaseToken.mockReturnValue(null);

    await expect(resolveUserId(req as any)).resolves.toBe('api-user-1');
  });

  it('returns null when no user identifier can be resolved', async () => {
    const req = {
      path: '/api/payment/checkout',
      body: {},
    };
    mocks.extractFirebaseToken.mockReturnValue(null);

    await expect(resolveUserId(req as any)).resolves.toBeNull();
  });
});
