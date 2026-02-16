import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  ensureStarterGrant: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@services/credits/UserCreditService', () => ({
  userCreditService: {
    ensureStarterGrant: mocks.ensureStarterGrant,
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

import { __resetStarterCreditsCacheForTests, starterCreditsMiddleware } from '../starterCredits';

type StarterReq = Request & {
  user?: {
    uid?: string;
  };
};

const createReq = (uid?: string): StarterReq =>
  ({
    user: uid ? { uid } : undefined,
  }) as StarterReq;

describe('starterCreditsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetStarterCreditsCacheForTests();
    delete process.env.FREE_TIER_STARTER_CREDITS;
    mocks.ensureStarterGrant.mockResolvedValue(false);
  });

  it('ensures starter grant for authenticated Firebase users', async () => {
    const req = createReq('firebase-user');
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await starterCreditsMiddleware(req, res, next);

    expect(mocks.ensureStarterGrant).toHaveBeenCalledWith('firebase-user', 25);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips starter grant for API key users', async () => {
    const req = createReq('api-key:test-key');
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await starterCreditsMiddleware(req, res, next);

    expect(mocks.ensureStarterGrant).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('fails open when service call throws', async () => {
    mocks.ensureStarterGrant.mockRejectedValueOnce(new Error('firestore down'));

    const req = createReq('firebase-user');
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await starterCreditsMiddleware(req, res, next);

    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'Starter credit bootstrap failed; continuing request',
      expect.objectContaining({ userId: 'firebase-user' })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses cache to avoid repeated service calls in a short window', async () => {
    const req = createReq('firebase-user');
    const res = {} as Response;
    const next = vi.fn() as NextFunction;

    await starterCreditsMiddleware(req, res, next);
    await starterCreditsMiddleware(req, res, next);

    expect(mocks.ensureStarterGrant).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
