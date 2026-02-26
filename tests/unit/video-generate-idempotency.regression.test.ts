import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createVideoGenerateHandler } from '@routes/preview/handlers/videoGenerate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const originalMode = process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE;

const createApp = (handler: ReturnType<typeof createVideoGenerateHandler>): express.Express => {
  const app = express();
  app.use((req, _res, next) => {
    (req as express.Request & { user?: { uid: string } }).user = { uid: 'user-123' };
    next();
  });
  app.use(express.json());
  app.post('/preview/video/generate', handler);
  return app;
};

describe('regression: video generate idempotency contract', () => {
  beforeEach(() => {
    process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE = 'required';
  });

  afterEach(() => {
    process.env.VIDEO_GENERATE_IDEMPOTENCY_MODE = originalMode;
  });

  it('requires Idempotency-Key when required mode is enabled', async () => {
    const requestIdempotencyService = {
      claimRequest: vi.fn(),
      markFailed: vi.fn(),
      markCompleted: vi.fn(),
    };

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: vi.fn(),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(),
        refundCredits: vi.fn(),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
      requestIdempotencyService: requestIdempotencyService as never,
    });
    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/video/generate').send({
        prompt: 'A cinematic shot.',
        model: 'sora-2',
      })
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
    expect(requestIdempotencyService.claimRequest).not.toHaveBeenCalled();
  });

  it('returns 409 conflict when same key is reused with different payload', async () => {
    const requestIdempotencyService = {
      claimRequest: vi.fn().mockResolvedValue({ state: 'conflict', recordId: 'rec-1' }),
      markFailed: vi.fn(),
      markCompleted: vi.fn(),
    };
    const reserveCredits = vi.fn();

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: vi.fn(),
      } as never,
      videoJobStore: {
        createJob: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits,
        refundCredits: vi.fn(),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
      requestIdempotencyService: requestIdempotencyService as never,
    });
    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .set('Idempotency-Key', 'same-key')
        .send({
          prompt: 'A cinematic shot.',
          model: 'sora-2',
        })
    );
    if (!response) return;

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
    });
    expect(reserveCredits).not.toHaveBeenCalled();
  });

  it('replays stored response for matching completed request', async () => {
    const requestIdempotencyService = {
      claimRequest: vi.fn().mockResolvedValue({
        state: 'replay',
        recordId: 'rec-2',
        snapshot: {
          statusCode: 202,
          body: {
            success: true,
            jobId: 'job-replayed',
            status: 'queued',
          },
        },
      }),
      markFailed: vi.fn(),
      markCompleted: vi.fn(),
    };
    const createJob = vi.fn();

    const handler = createVideoGenerateHandler({
      videoGenerationService: {
        getModelAvailability: vi.fn(),
      } as never,
      videoJobStore: {
        createJob,
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(),
        refundCredits: vi.fn(),
      } as never,
      keyframeService: null as never,
      faceSwapService: null as never,
      assetService: null as never,
      requestIdempotencyService: requestIdempotencyService as never,
    });
    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/video/generate')
        .set('Idempotency-Key', 'replay-key')
        .send({
          prompt: 'A cinematic shot.',
          model: 'sora-2',
        })
    );
    if (!response) return;

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      success: true,
      jobId: 'job-replayed',
      status: 'queued',
    });
    expect(createJob).not.toHaveBeenCalled();
  });
});

