import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRefundKey } from '@services/credits/refundGuard';
import { createFaceSwapPreviewHandler } from '@routes/preview/handlers/faceSwap';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const { getAuthenticatedUserIdMock } = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
}));

vi.mock('@routes/preview/auth', () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

describe('faceSwap preview refunds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-1');
  });

  it('refunds reserved face-swap credits when character has no reference image', async () => {
    const refundCreditsMock = vi.fn(async () => true);

    const handler = createFaceSwapPreviewHandler({
      faceSwapService: {
        swap: vi.fn(),
      } as never,
      assetService: {
        getAssetForGeneration: vi.fn(async () => ({
          primaryImageUrl: null,
        })),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(async () => true),
        refundCredits: refundCreditsMock,
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-fs-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/face-swap', handler);

    const targetImageUrl = 'https://images.example.com/target.webp';
    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/face-swap').send({
        characterAssetId: 'char-1',
        targetImageUrl,
      })
    );
    if (!response) return;

    const expectedRefundKey = buildRefundKey([
      'preview-face-swap',
      'req-fs-1',
      'user-1',
      'char-1',
      targetImageUrl,
    ]);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: 'Character has no reference image',
      code: 'INVALID_REQUEST',
      requestId: 'req-fs-1',
    });
    expect(refundCreditsMock).toHaveBeenCalledWith(
      'user-1',
      2,
      expect.objectContaining({
        refundKey: expectedRefundKey,
        reason: 'face swap character missing reference image',
      })
    );
  });
});
