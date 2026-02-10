import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
