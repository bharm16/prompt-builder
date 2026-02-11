import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORYBOARD_FRAME_COUNT } from '@services/image-generation/storyboard/constants';
import { buildRefundKey } from '@services/credits/refundGuard';
import { createImageStoryboardGenerateHandler } from '@routes/preview/handlers/imageStoryboardGenerate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const { getAuthenticatedUserIdMock } = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
}));

vi.mock('@routes/preview/auth', () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

describe('imageStoryboardGenerate refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-1');
  });

  it('reserves credits, runs generation, and does not refund on success', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
    const refundCreditsMock = vi.fn(async () => true);
    const generateStoryboardMock = vi.fn(async () => ({
      imageUrls: ['https://images.example.com/frame-1.webp'],
      storagePaths: ['users/u/preview-image/f1.webp'],
      deltas: ['0'],
      baseImageUrl: 'https://images.example.com/base.webp',
    }));

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: generateStoryboardMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
      assetService: null as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-sb-success-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/generate/storyboard', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({
        prompt: 'A storyboard prompt',
      })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', STORYBOARD_FRAME_COUNT);
    expect(generateStoryboardMock).toHaveBeenCalledTimes(1);
    expect(refundCreditsMock).not.toHaveBeenCalled();
  });

  it('rejects generation when reservation fails and never starts provider', async () => {
    const reserveCreditsMock = vi.fn(async () => false);
    const refundCreditsMock = vi.fn(async () => true);
    const generateStoryboardMock = vi.fn();

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: generateStoryboardMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
      assetService: null as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-sb-insufficient-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/generate/storyboard', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({
        prompt: 'A storyboard prompt',
      })
    );
    if (!response) return;

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({
      error: 'Insufficient credits',
      code: 'INSUFFICIENT_CREDITS',
      requestId: 'req-sb-insufficient-1',
    });
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', STORYBOARD_FRAME_COUNT);
    expect(generateStoryboardMock).not.toHaveBeenCalled();
    expect(refundCreditsMock).not.toHaveBeenCalled();
  });

  it('refunds reserved storyboard credits with deterministic key on generation failure', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: vi.fn(async () => {
          throw new Error('planner failed');
        }),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      assetService: null as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-sb-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/generate/storyboard', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({
        prompt: 'A storyboard prompt',
      })
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      'preview-storyboard',
      'req-sb-1',
      'user-1',
      'generation',
    ]);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Storyboard generation failed',
      code: 'GENERATION_FAILED',
      requestId: 'req-sb-1',
    });
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-1',
      STORYBOARD_FRAME_COUNT,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: 'preview storyboard generation failed',
      })
    );
  });
});
