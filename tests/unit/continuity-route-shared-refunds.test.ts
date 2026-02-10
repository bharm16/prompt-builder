import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { buildRefundKey } from '@services/credits/refundGuard';

const { calculateShotCostMock } = vi.hoisted(() => ({
  calculateShotCostMock: vi.fn(),
}));

vi.mock('@services/continuity/CreditCostCalculator', () => ({
  CreditCostCalculator: {
    calculateShotCost: calculateShotCostMock,
  },
}));

import { handleGenerateShot } from '@routes/continuity/continuityRouteShared';

describe('continuity generate shot refunds', () => {
  it('uses catchAll deterministic refund key on generation exception', async () => {
    calculateShotCostMock.mockReturnValue({
      generationMode: 'continuity',
      continuityMode: 'frame-bridge',
      videoCost: 10,
      extraCost: 0,
      perAttemptCost: 10,
      maxRetries: 2,
      totalCost: 30,
    });

    const req = {
      id: 'req-continuity-1',
      params: {
        shotId: 'shot-1',
      },
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    const userCreditService = {
      reserveCredits: vi.fn(async () => true),
      refundCredits: vi.fn(async () => true),
    };

    const service = {
      generateShot: vi.fn(async () => {
        throw new Error('provider failed');
      }),
    };

    const session = {
      id: 'session-1',
      userId: 'user-1',
      shots: [{ id: 'shot-1' }],
    };

    await handleGenerateShot(
      service as never,
      session as never,
      req,
      res,
      userCreditService as never
    );

    const expectedRefundKey = buildRefundKey([
      'continuity-shot',
      'req-continuity-1',
      'catchAll',
    ]);

    expect(userCreditService.refundCredits).toHaveBeenCalledWith(
      'user-1',
      30,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: 'continuity shot generation exception',
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Shot generation failed',
        code: 'GENERATION_FAILED',
        requestId: 'req-continuity-1',
      })
    );
  });
});
