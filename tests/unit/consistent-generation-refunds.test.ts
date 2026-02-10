import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { buildRefundKey } from '@services/credits/refundGuard';
import { createConsistentGenerationRoutes } from '@routes/consistentGeneration.routes';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

type Case = {
  endpoint: '/keyframe' | '/video' | '/from-keyframe';
  requestId: string;
  body: Record<string, unknown>;
  expectedAmount: number;
  expectedReason: string;
  expectedSuffix: 'keyframe' | 'video' | 'from-keyframe';
};

const cases: Case[] = [
  {
    endpoint: '/keyframe',
    requestId: 'req-consistent-keyframe',
    body: { characterId: 'char-1', prompt: 'A keyframe prompt' },
    expectedAmount: 2,
    expectedReason: 'consistent keyframe generation failed',
    expectedSuffix: 'keyframe',
  },
  {
    endpoint: '/video',
    requestId: 'req-consistent-video',
    body: { prompt: 'A consistent video prompt' },
    expectedAmount: 40,
    expectedReason: 'consistent video generation failed',
    expectedSuffix: 'video',
  },
  {
    endpoint: '/from-keyframe',
    requestId: 'req-consistent-from-keyframe',
    body: { keyframeUrl: 'https://images.example.com/keyframe.webp', prompt: 'Video from keyframe' },
    expectedAmount: 35,
    expectedReason: 'consistent from-keyframe generation failed',
    expectedSuffix: 'from-keyframe',
  },
];

describe('consistent generation refunds', () => {
  it.each(cases)(
    'refunds reserved credits for $endpoint with deterministic key',
    async ({ endpoint, requestId, body, expectedAmount, expectedReason, expectedSuffix }) => {
      const refundCreditsMock = vi.fn(async () => true);

      const consistentVideoService = {
        generateKeyframeOnly: vi.fn(async () => {
          throw new Error('generation failed');
        }),
        generateConsistentVideo: vi.fn(async () => {
          throw new Error('generation failed');
        }),
        generateVideoFromApprovedKeyframe: vi.fn(async () => {
          throw new Error('generation failed');
        }),
      };

      const router = createConsistentGenerationRoutes(consistentVideoService as never, {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never);

      const app = express();
      app.use((req, _res, next) => {
        (req as express.Request & { id?: string; user?: { uid?: string } }).id = requestId;
        (req as express.Request & { id?: string; user?: { uid?: string } }).user = { uid: 'user-1' };
        next();
      });
      app.use(express.json());
      app.use('/api/generate/consistent', router);

      const response = await runSupertestOrSkip(() =>
        request(app).post(`/api/generate/consistent${endpoint}`).send(body)
      );
      if (!response) return;

      const expectedRefundKey = buildRefundKey([
        'consistent-generation',
        requestId,
        expectedSuffix,
      ]);

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        error: 'Generation failed',
        code: 'GENERATION_FAILED',
        requestId,
      });
      expect(refundCreditsMock).toHaveBeenCalledWith(
        'user-1',
        expectedAmount,
        expect.objectContaining({
          refundKey: expectedRefundKey,
          reason: expectedReason,
        })
      );
    }
  );
});
