import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { buildRefundKey } from '@services/credits/refundGuard';
import { createImageGenerateHandler } from '@routes/preview/handlers/imageGenerate';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const { getAuthenticatedUserIdMock } = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
}));

vi.mock('@routes/preview/auth', () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

describe('imageGenerate refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-1');
  });

  it('reserves credits, runs generation, and does not refund on success', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
    const refundCreditsMock = vi.fn(async () => true);
    const generatePreviewMock = vi.fn(async () => ({
      imageUrl: 'https://images.example.com/generated.webp',
      metadata: {
        model: 'test-model',
        aspectRatio: '16:9',
      },
    }));

    const handler = createImageGenerateHandler({
      imageGenerationService: {
        generatePreview: generatePreviewMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
      assetService: null as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-img-success-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate').send({
        prompt: 'A dramatic portrait',
      })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', 1);
    expect(generatePreviewMock).toHaveBeenCalledTimes(1);
    expect(refundCreditsMock).not.toHaveBeenCalled();
  });

  it('rejects generation when reservation fails and never starts provider', async () => {
    const reserveCreditsMock = vi.fn(async () => false);
    const refundCreditsMock = vi.fn(async () => true);
    const generatePreviewMock = vi.fn();

    const handler = createImageGenerateHandler({
      imageGenerationService: {
        generatePreview: generatePreviewMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
      assetService: null as never,
    });
    const req = {
      id: 'req-img-insufficient-1',
      path: '/preview/generate',
      body: { prompt: 'A dramatic portrait' },
    } as unknown as Request;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Insufficient credits',
        code: 'INSUFFICIENT_CREDITS',
        requestId: 'req-img-insufficient-1',
      })
    );
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', 1);
    expect(generatePreviewMock).not.toHaveBeenCalled();
    expect(refundCreditsMock).not.toHaveBeenCalled();
  });

  it('refunds reserved preview credit with deterministic key when generation fails', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createImageGenerateHandler({
      imageGenerationService: {
        generatePreview: vi.fn(async () => {
          throw new Error('provider down');
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
      (req as express.Request & { id?: string }).id = 'req-img-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/generate').send({
        prompt: 'A dramatic portrait',
      })
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      'preview-image',
      'req-img-1',
      'user-1',
      'generation',
    ]);

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Image generation failed',
      code: 'GENERATION_FAILED',
      requestId: 'req-img-1',
    });
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-1',
      1,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: 'preview image generation failed',
      })
    );
  });
});
