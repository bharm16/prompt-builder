import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getVideoCost } from '@config/modelCosts';

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

    const reserveCreditsMock = vi.fn(async () => true);

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
        refundCredits: vi.fn(async () => undefined),
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

    const response = await request(app)
      .post('/preview/video/generate')
      .send({
        prompt: 'A cinematic portrait shot.',
        model: 'sora-2',
        startImage: 'https://images.example.com/start.webp',
        characterAssetId: 'char-123',
      });

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
        refundCredits: vi.fn(async () => undefined),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await request(app)
      .post('/preview/video/generate')
      .send({
        prompt: 'A cinematic portrait shot.',
        model: 'sora-2',
        startImage: 'https://images.example.com/start.webp',
        characterAssetId: 'char-123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Face-swap not available');
  });

  it('generates a PuLID keyframe when only characterAssetId is provided', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-2',
      status: 'queued',
      ...payload,
    }));

    const reserveCreditsMock = vi.fn(async () => true);

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
        refundCredits: vi.fn(async () => undefined),
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

    const response = await request(app)
      .post('/preview/video/generate')
      .send({
        prompt: 'A cinematic portrait shot.',
        model: 'sora-2',
        characterAssetId: 'char-123',
      });

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
        refundCredits: vi.fn(async () => undefined),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
    });

    const app = express();
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await request(app)
      .post('/preview/video/generate')
      .send({
        prompt: 'A cinematic portrait shot.',
        model: 'sora-2',
        startImage: 'https://images.example.com/start.webp',
      });

    expect(response.status).toBe(202);
    expect(response.body.keyframeGenerated).toBe(false);
    expect(response.body.faceSwapApplied).toBe(false);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { options?: { startImage?: string } } }
      | undefined;
    expect(jobPayload?.request?.options?.startImage).toBe('https://images.example.com/start.webp');
  });

  it('refunds face swap credits when preprocessing fails', async () => {
    const refundCreditsMock = vi.fn(async () => undefined);

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
    app.use(express.json());
    app.post('/preview/video/generate', handler);

    const response = await request(app)
      .post('/preview/video/generate')
      .send({
        prompt: 'A cinematic portrait shot.',
        model: 'sora-2',
        startImage: 'https://images.example.com/start.webp',
        characterAssetId: 'char-123',
      });

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Face-swap failed');
    expect(refundCreditsMock).toHaveBeenCalledWith('user-123', 2);
  });
});
