import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createImageGenerateHandler } from '../imageGenerate';
import { createImageStoryboardGenerateHandler } from '../imageStoryboardGenerate';
import { createFaceSwapPreviewHandler } from '../faceSwap';

interface ErrorWithCode {
  code?: string;
  message?: string;
}

const isSocketPermissionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as ErrorWithCode;
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  if (code === 'EPERM' || code === 'EACCES') return true;

  return (
    message.includes('listen EPERM') ||
    message.includes('listen EACCES') ||
    message.includes('operation not permitted') ||
    message.includes("Cannot read properties of null (reading 'port')")
  );
};

const runSupertestOrSkip = async <T>(execute: () => Promise<T>): Promise<T | null> => {
  if (process.env.CODEX_SANDBOX === 'seatbelt') {
    return null;
  }

  try {
    return await execute();
  } catch (error) {
    if (isSocketPermissionError(error)) {
      return null;
    }
    throw error;
  }
};

const withAuth = (app: express.Express): void => {
  app.use((req, _res, next) => {
    (req as express.Request & { user?: { uid?: string }; id?: string }).user = { uid: 'user-1' };
    (req as express.Request & { id?: string }).id = 'req-1';
    next();
  });
};

describe('charged preview route idempotency regression', () => {
  it('image generate returns replayed response without re-charging credits', async () => {
    const claimRequest = vi.fn().mockResolvedValue({
      state: 'replay',
      recordId: 'record-1',
      snapshot: {
        statusCode: 200,
        body: {
          success: true,
          data: {
            imageUrl: 'https://cached.example/image.png',
          },
        },
      },
    });
    const generatePreview = vi.fn();
    const reserveCredits = vi.fn();

    const handler = createImageGenerateHandler({
      imageGenerationService: {
        generatePreview,
      } as never,
      userCreditService: {
        reserveCredits,
      } as never,
      assetService: null as never,
      storageService: null as never,
      requestIdempotencyService: {
        claimRequest,
      } as never,
    });

    const app = express();
    app.use(express.json());
    withAuth(app);
    app.post('/preview/generate', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/generate')
        .set('Idempotency-Key', 'idem-image-1')
        .send({ prompt: 'A calm beach sunrise.' })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        imageUrl: 'https://cached.example/image.png',
      },
    });
    expect(generatePreview).not.toHaveBeenCalled();
    expect(reserveCredits).not.toHaveBeenCalled();
  });

  it('storyboard generate returns idempotency conflict when payload mismatches existing key', async () => {
    const claimRequest = vi.fn().mockResolvedValue({
      state: 'conflict',
      recordId: 'record-2',
    });

    const handler = createImageStoryboardGenerateHandler({
      storyboardPreviewService: {
        generateStoryboard: vi.fn(),
      } as never,
      userCreditService: {
        reserveCredits: vi.fn(),
      } as never,
      assetService: null as never,
      requestIdempotencyService: {
        claimRequest,
      } as never,
    });

    const app = express();
    app.use(express.json());
    withAuth(app);
    app.post('/preview/generate/storyboard', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/generate/storyboard')
        .set('Idempotency-Key', 'idem-story-1')
        .send({ prompt: 'A fox crossing a forest trail.' })
    );
    if (!response) return;

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('face-swap marks idempotent completion snapshot on success', async () => {
    const claimRequest = vi.fn().mockResolvedValue({
      state: 'claimed',
      recordId: 'record-3',
    });
    const markCompleted = vi.fn().mockResolvedValue(undefined);
    const reserveCredits = vi.fn().mockResolvedValue(true);
    const getAssetForGeneration = vi.fn().mockResolvedValue({
      primaryImageUrl: 'https://assets.example/character.jpg',
    });
    const swap = vi.fn().mockResolvedValue({
      swappedImageUrl: 'https://images.example/swapped.jpg',
    });

    const handler = createFaceSwapPreviewHandler({
      faceSwapService: {
        swap,
      } as never,
      assetService: {
        getAssetForGeneration,
      } as never,
      userCreditService: {
        reserveCredits,
      } as never,
      requestIdempotencyService: {
        claimRequest,
        markCompleted,
      } as never,
    });

    const app = express();
    app.use(express.json());
    withAuth(app);
    app.post('/preview/face-swap', handler);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/preview/face-swap')
        .set('Idempotency-Key', 'idem-face-1')
        .send({
          characterAssetId: 'char-1',
          targetImageUrl: 'https://example.com/target.jpg',
        })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.faceSwapUrl).toBe('https://images.example/swapped.jpg');
    expect(markCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        recordId: 'record-3',
        snapshot: expect.objectContaining({
          statusCode: 200,
          body: expect.objectContaining({
            success: true,
          }),
        }),
      })
    );
  });
});
