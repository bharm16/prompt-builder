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

  it('reserves credits, generates swap, and does not refund on success', async () => {
    const reserveCreditsMock = vi.fn(async () => true);
    const refundCreditsMock = vi.fn(async () => true);
    const getAssetForGenerationMock = vi.fn(async () => ({
      primaryImageUrl: 'https://images.example.com/source.webp',
    }));
    const swapMock = vi.fn(async () => ({
      swappedImageUrl: 'https://images.example.com/swapped.webp',
    }));

    const handler = createFaceSwapPreviewHandler({
      faceSwapService: {
        swap: swapMock,
      } as never,
      assetService: {
        getAssetForGeneration: getAssetForGenerationMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-fs-success-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/face-swap', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/face-swap').send({
        characterAssetId: 'char-1',
        targetImageUrl: 'https://images.example.com/target.webp',
      })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', 2);
    expect(getAssetForGenerationMock).toHaveBeenCalledTimes(1);
    expect(swapMock).toHaveBeenCalledTimes(1);
    expect(refundCreditsMock).not.toHaveBeenCalled();
  });

  it('rejects generation when reservation fails and never starts provider', async () => {
    const reserveCreditsMock = vi.fn(async () => false);
    const refundCreditsMock = vi.fn(async () => true);
    const getAssetForGenerationMock = vi.fn();
    const swapMock = vi.fn();

    const handler = createFaceSwapPreviewHandler({
      faceSwapService: {
        swap: swapMock,
      } as never,
      assetService: {
        getAssetForGeneration: getAssetForGenerationMock,
      } as never,
      userCreditService: {
        reserveCredits: reserveCreditsMock,
        refundCredits: refundCreditsMock,
      } as never,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as express.Request & { id?: string }).id = 'req-fs-insufficient-1';
      next();
    });
    app.use(express.json());
    app.post('/preview/face-swap', handler);

    const response = await runSupertestOrSkip(() =>
      request(app).post('/preview/face-swap').send({
        characterAssetId: 'char-1',
        targetImageUrl: 'https://images.example.com/target.webp',
      })
    );
    if (!response) return;

    expect(response.status).toBe(402);
    expect(response.body).toMatchObject({
      error: 'Insufficient credits',
      code: 'INSUFFICIENT_CREDITS',
      requestId: 'req-fs-insufficient-1',
    });
    expect(reserveCreditsMock).toHaveBeenCalledWith('user-1', 2);
    expect(getAssetForGenerationMock).not.toHaveBeenCalled();
    expect(swapMock).not.toHaveBeenCalled();
    expect(refundCreditsMock).not.toHaveBeenCalled();
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
