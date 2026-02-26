import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { ContinuitySession } from '@services/continuity/types';

const mocks = vi.hoisted(() => ({
  refundWithGuard: vi.fn().mockResolvedValue(true),
  buildRefundKey: vi.fn((parts: unknown[]) => parts.map(String).join('|')),
}));

vi.mock('@services/credits/refundGuard', () => ({
  refundWithGuard: mocks.refundWithGuard,
  buildRefundKey: mocks.buildRefundKey,
}));

import {
  handleCreateShot,
  handleGenerateShot,
  handleUpdateShot,
  requireSessionForUser,
} from '../continuityRouteShared';

const createResponse = (): Response => {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as unknown as Response;
};

const buildSession = (): ContinuitySession => ({
  id: 'session-1',
  userId: 'user-1',
  name: 'Session',
  primaryStyleReference: {
    id: 'style-1',
    sourceVideoId: 'video-1',
    sourceFrameIndex: 0,
    frameUrl: 'https://example.com/style.png',
    frameTimestamp: 0,
    resolution: { width: 1920, height: 1080 },
    aspectRatio: '16:9',
    extractedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  shots: [
    {
      id: 'shot-1',
      sessionId: 'session-1',
      sequenceIndex: 0,
      userPrompt: 'Prompt',
      continuityMode: 'frame-bridge',
      styleStrength: 0.6,
      styleReferenceId: null,
      modelId: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
      status: 'draft',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ],
  defaultSettings: {
    generationMode: 'continuity',
    defaultContinuityMode: 'frame-bridge',
    defaultStyleStrength: 0.6,
    defaultModel: 'model-a' as ContinuitySession['defaultSettings']['defaultModel'],
    autoExtractFrameBridge: false,
    useCharacterConsistency: false,
    maxRetries: 1,
  },
  status: 'active',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('continuityRouteShared', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requireSessionForUser handles auth and ownership failures', async () => {
    const service = {
      getSession: vi.fn().mockResolvedValue(buildSession()),
    };

    const noUserReq = {
      params: { sessionId: 'session-1' },
    } as unknown as Request;
    const noUserRes = createResponse();
    await expect(requireSessionForUser(service as never, noUserReq, noUserRes)).resolves.toBeNull();
    expect((noUserRes as any).statusCode).toBe(401);

    const wrongUserReq = {
      params: { sessionId: 'session-1' },
      user: { uid: 'other-user' },
    } as unknown as Request;
    const wrongUserRes = createResponse();
    await expect(requireSessionForUser(service as never, wrongUserReq, wrongUserRes)).resolves.toBeNull();
    expect((wrongUserRes as any).statusCode).toBe(403);
  });

  it('returns validation errors for invalid create/update shot payloads', async () => {
    const service = {
      addShot: vi.fn(),
      updateShot: vi.fn(),
    };

    const createReq = {
      body: {},
    } as Request;
    const createRes = createResponse();
    await handleCreateShot(service as never, createReq, createRes, { sessionId: 'session-1' });
    expect((createRes as any).statusCode).toBe(400);
    expect(service.addShot).not.toHaveBeenCalled();

    const updateReq = {
      body: { styleStrength: 'bad' },
    } as unknown as Request;
    const updateRes = createResponse();
    await handleUpdateShot(service as never, updateReq, updateRes, {
      sessionId: 'session-1',
      shotId: 'shot-1',
    });
    expect((updateRes as any).statusCode).toBe(400);
    expect(service.updateShot).not.toHaveBeenCalled();
  });

  it('refunds unused retry budget on successful generation', async () => {
    const session = buildSession();
    const service = {
      generateShot: vi.fn().mockResolvedValue({
        ...session.shots[0],
        status: 'completed',
        retryCount: 0,
      }),
    };
    const userCreditService = {
      reserveCredits: vi.fn().mockResolvedValue(true),
    };
    const req = {
      params: { shotId: 'shot-1' },
      id: 'request-1',
    } as unknown as Request;
    const res = createResponse();

    await handleGenerateShot(service as never, session, req, res, userCreditService as never);

    expect(userCreditService.reserveCredits).toHaveBeenCalled();
    expect(mocks.refundWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'continuity shot unused retry budget' })
    );
    expect((res as any).statusCode).toBe(200);
  });

  it('refunds actual spent cost when generation returns failed status', async () => {
    const session = buildSession();
    const service = {
      generateShot: vi.fn().mockResolvedValue({
        ...session.shots[0],
        status: 'failed',
        retryCount: 1,
      }),
    };
    const userCreditService = {
      reserveCredits: vi.fn().mockResolvedValue(true),
    };
    const req = {
      params: { shotId: 'shot-1' },
      id: 'request-2',
    } as unknown as Request;
    const res = createResponse();

    await handleGenerateShot(service as never, session, req, res, userCreditService as never);

    expect(mocks.refundWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'continuity shot failed actual cost' })
    );
    expect((res as any).statusCode).toBe(200);
  });

  it('issues catch-all refund and canonical error response when generation throws', async () => {
    const session = buildSession();
    const service = {
      generateShot: vi.fn().mockRejectedValue(new Error('generator crashed')),
    };
    const userCreditService = {
      reserveCredits: vi.fn().mockResolvedValue(true),
    };
    const req = {
      params: { shotId: 'shot-1' },
      id: 'request-3',
    } as unknown as Request;
    const res = createResponse();

    await handleGenerateShot(service as never, session, req, res, userCreditService as never);

    expect(mocks.refundWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'continuity shot generation exception' })
    );
    expect((res as any).statusCode).toBe(500);
    expect((res as any).body).toEqual(
      expect.objectContaining({
        error: 'Shot generation failed',
        details: 'generator crashed',
      })
    );
  });
});
