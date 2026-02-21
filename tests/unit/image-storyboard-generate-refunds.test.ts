import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { STORYBOARD_FRAME_COUNT } from '@services/image-generation/storyboard/constants';
import { buildRefundKey } from '@services/credits/refundGuard';
import { createImageStoryboardGenerateHandler } from '@routes/preview/handlers/imageStoryboardGenerate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const createApp = (
  handler: express.RequestHandler,
  requestId = 'req-sb-1',
  userId: string | null = 'user-1'
) => {
  const app = express();
  app.use((req, _res, next) => {
    (req as express.Request & { id?: string }).id = requestId;
    const requestWithUser = req as express.Request & { user?: { uid?: string } | undefined };
    if (userId) {
      requestWithUser.user = { uid: userId };
    } else {
      delete requestWithUser.user;
    }
    next();
  });
  app.use(express.json());
  app.post('/preview/generate/storyboard', handler);
  return app;
};

describe('imageStoryboardGenerate refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    const app = createApp(handler, 'req-sb-success-1');

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

    const app = createApp(handler, 'req-sb-insufficient-1');

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

    const app = createApp(handler, 'req-sb-1');

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

  it('returns 401 when authentication is missing', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
    const generateStoryboardMock = vi.fn();

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: generateStoryboardMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      assetService: null as never,
    });

    const app = createApp(handler, 'req-sb-auth-1', null);
    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({ prompt: 'A storyboard prompt' })
    );
    if (!response) return;

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED',
      requestId: 'req-sb-auth-1',
    });
    expect(reserveCreditsMock).not.toHaveBeenCalled();
    expect(generateStoryboardMock).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'prompt', body: { prompt: '   ' }, error: 'Prompt must be a non-empty string' },
    {
      name: 'speedMode',
      body: { prompt: 'A storyboard prompt', speedMode: 'warp-speed' },
      error: 'speedMode must be one of: Lightly Juiced, Juiced, Extra Juiced, Real Time',
    },
    {
      name: 'seed',
      body: { prompt: 'A storyboard prompt', seed: 'invalid-seed' },
      error: 'Invalid input: expected number, received string',
    },
  ])('returns 400 for invalid parsed request field $name', async ({ body, error }) => {
    const reserveCreditsMock = vi.fn(async () => true);
    const generateStoryboardMock = vi.fn();

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: generateStoryboardMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      assetService: null as never,
    });

    const app = createApp(handler, 'req-sb-parse-1');
    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send(body)
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error,
      code: 'INVALID_REQUEST',
      requestId: 'req-sb-parse-1',
    });
    expect(reserveCreditsMock).not.toHaveBeenCalled();
    expect(generateStoryboardMock).not.toHaveBeenCalled();
  });

  it('charges one fewer frame when seedImageUrl is provided', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
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
        refundCredits: vi.fn(async () => true),
      } as never,
      assetService: null as never,
    });

    const app = createApp(handler, 'req-sb-seed-credits-1');
    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({
        prompt: 'A storyboard prompt',
        seedImageUrl: 'https://images.example.com/seed.webp',
      })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', STORYBOARD_FRAME_COUNT - 1);
    expect(generateStoryboardMock).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when storyboard preview service is missing', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: null as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      assetService: null as never,
    });

    const app = createApp(handler, 'req-sb-missing-service-1');
    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate/storyboard').send({ prompt: 'A storyboard prompt' })
    );
    if (!response) return;

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      error: 'Storyboard preview service is not available',
      code: 'SERVICE_UNAVAILABLE',
      requestId: 'req-sb-missing-service-1',
    });
    expect(reserveCreditsMock).not.toHaveBeenCalled();
  });
});
