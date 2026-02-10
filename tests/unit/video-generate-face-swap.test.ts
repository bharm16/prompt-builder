import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVideoCost } from '@config/modelCosts';
import { buildRefundKey } from '@services/credits/refundGuard';

const { getAuthenticatedUserIdMock, scheduleInlineMock } = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
  scheduleInlineMock: vi.fn(),
}));

vi.mock('@routes/preview/auth', () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

vi.mock('@routes/preview/inlineProcessor', () => ({
  scheduleInlineVideoPreviewProcessing: scheduleInlineMock,
}));

import { createVideoGenerateHandler } from '@routes/preview/handlers/videoGenerate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

describe('videoGenerate face swap preprocessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-123');
  });

  it('performs face swap when startImage and characterAssetId are provided', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-1',
      status: 'queued',
      ...payload,
    }));

    const reserveCreditsMock = vi.fn(
      async (_userId: string, _amount: number) => true
    );

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
        getAvailabilityReport: () => ({ availableModels: [] }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => ({
          swappedImageUrl: 'https://images.example.com/swapped.webp',
          provider: 'easel',
          durationMs: 1200,
        })),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
        })),
      } as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'A cinematic portrait shot.',
          model: 'sora-2',
          startImage: 'https://images.example.com/start.webp',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.faceSwapApplied).toBe(true);
    expect(response.body.faceSwapUrl).toBe('https://images.example.com/swapped.webp');
    expect(response.body.keyframeGenerated).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe('https://images.example.com/swapped.webp');

    const faceSwapCall = reserveCreditsMock.mock.calls.find((call) => call[1] === 2);
    expect(faceSwapCall).toBeTruthy();

    const expectedVideoCost = getVideoCost('sora-2', 8);
    expect(response.body.creditsDeducted).toBe(expectedVideoCost + 2);
  });

  it('returns a 400 when face swap service is unavailable', async () => {
    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'A cinematic portrait shot.',
          model: 'sora-2',
          startImage: 'https://images.example.com/start.webp',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Face-swap not available');
  });

  it('generates a PuLID keyframe when only characterAssetId is provided', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-2',
      status: 'queued',
      ...payload,
    }));

    const reserveCreditsMock = vi.fn(
      async (_userId: string, _amount: number) => true
    );

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: {
        generateKeyframe: vi.fn(async () => ({
          imageUrl: 'https://images.example.com/keyframe.webp',
          faceStrength: 0.7,
        })),
      } as never,
      faceSwapService: null as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'A cinematic portrait shot.',
          model: 'sora-2',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(true);
    expect(response.body.keyframeUrl).toBe('https://images.example.com/keyframe.webp');
    expect(response.body.faceSwapApplied).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe('https://images.example.com/keyframe.webp');

    const keyframeCall = reserveCreditsMock.mock.calls.find((call) => call[1] === 2);
    expect(keyframeCall).toBeTruthy();
  });

  it('resolves @triggers and auto-selects characterAssetId when not provided', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-trigger',
      status: 'queued',
      ...payload,
    }));
    const generateKeyframeMock = vi.fn(async () => ({
      imageUrl: 'https://images.example.com/keyframe-trigger.webp',
      faceStrength: 0.7,
    }));
    const resolvePromptMock = vi.fn(async () => ({
      originalText: '@matt walks through a neon alley',
      expandedText: 'Matt Harmon walks through a neon alley',
      assets: [{ id: 'char-999' }],
      characters: [{ id: 'char-999' }],
      styles: [],
      locations: [],
      objects: [],
      requiresKeyframe: true,
      negativePrompts: [],
      referenceImages: [],
    }));

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: {
        generateKeyframe: generateKeyframeMock,
      } as never,
      faceSwapService: null as never,
      assetService: {
        resolvePrompt: resolvePromptMock,
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: '@matt walks through a neon alley',
          model: 'sora-2',
        })
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(true);
    expect(resolvePromptMock).toHaveBeenCalledWith(
      'user-123',
      '@matt walks through a neon alley'
    );
    expect(generateKeyframeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Matt Harmon walks through a neon alley',
      })
    );

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { prompt?: string; options?: { characterAssetId?: string } } }
      | undefined;
    expect(jobPayload?.request?.prompt).toBe('Matt Harmon walks through a neon alley');
    expect(jobPayload?.request?.options?.characterAssetId).toBe('char-999');
  });

  it('uses the provided startImage directly when no characterAssetId is set', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-3',
      status: 'queued',
      ...payload,
    }));

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: createJobMock,
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: vi.fn(async () => true),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'A cinematic portrait shot.',
          model: 'sora-2',
          startImage: 'https://images.example.com/start.webp',
        })
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(false);
    expect(response.body.faceSwapApplied).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe('https://images.example.com/start.webp');
  });

  it('refunds face swap credits when preprocessing fails', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => {
          throw new Error('Fal swap down');
        }),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
        })),
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-refund-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'A cinematic portrait shot.',
          model: 'sora-2',
          startImage: 'https://images.example.com/start.webp',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      'preview-video',
      'req-refund-1',
      'user-123',
      'faceSwap',
    ]);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Face-swap failed');
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-123',
      2,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: 'video face-swap preprocessing failed',
      })
    );
  });

  it('refunds video and face-swap credits when queueing fails after face-swap preprocessing', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(async () => {
          throw new Error('queue unavailable');
        }),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: null as never,
      faceSwapService: {
        swap: vi.fn(async () => ({
          swappedImageUrl: 'https://images.example.com/swapped.webp',
          provider: 'easel',
          durationMs: 400,
        })),
        isAvailable: () => true,
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
        })),
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-queue-fs-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'Queue failure should refund all reserved credits.',
          model: 'sora-2',
          startImage: 'https://images.example.com/start.webp',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    const expectedFaceSwapRefundKey = buildRefundKey([
      'preview-video',
      'req-queue-fs-1',
      'user-123',
      'faceSwap',
    ]);
    const expectedVideoRefundKey = buildRefundKey([
      'preview-video',
      'req-queue-fs-1',
      'user-123',
      'video',
    ]);
    const expectedVideoCost = getVideoCost('sora-2', 8);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Video generation failed',
      code: 'GENERATION_FAILED',
      requestId: 'req-queue-fs-1',
    });

    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-123',
      expectedVideoCost,
      expect.objectContaining({
        refundKey: expectedVideoRefundKey,
        reason: 'video queueing failed',
      })
    );
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-123',
      2,
      expect.objectContaining({
        refundKey: expectedFaceSwapRefundKey,
        reason: 'video queueing failed after face-swap reservation',
      })
    );
  });

  it('refunds video and keyframe credits when queueing fails after keyframe preprocessing', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: () => ({
          available: true,
          resolvedModelId: 'sora-2',
        }),
      } as never,
      videoJobStore: {
        createJob: vi.fn(async () => {
          throw new Error('queue unavailable');
        }),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
      keyframeService: {
        generateKeyframe: vi.fn(async () => ({
          imageUrl: 'https://images.example.com/keyframe.webp',
          faceStrength: 0.7,
        })),
      } as never,
      faceSwapService: null as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: 'https://images.example.com/face.webp',
          negativePrompt: null,
          faceEmbedding: null,
        })),
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-queue-kf-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .send({
          prompt: 'Queue failure should refund keyframe and video reserves.',
          model: 'sora-2',
          characterAssetId: 'char-123',
        })
    );
    if (!response) return;

    const expectedKeyframeRefundKey = buildRefundKey([
      'preview-video',
      'req-queue-kf-1',
      'user-123',
      'keyframe',
    ]);
    const expectedVideoRefundKey = buildRefundKey([
      'preview-video',
      'req-queue-kf-1',
      'user-123',
      'video',
    ]);
    const expectedVideoCost = getVideoCost('sora-2', 8);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Video generation failed',
      code: 'GENERATION_FAILED',
      requestId: 'req-queue-kf-1',
    });

    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-123',
      expectedVideoCost,
      expect.objectContaining({
        refundKey: expectedVideoRefundKey,
        reason: 'video queueing failed',
      })
    );
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-123',
      2,
      expect.objectContaining({
        refundKey: expectedKeyframeRefundKey,
        reason: 'video queueing failed after keyframe reservation',
      })
    );
  });
});
