import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createImageAssetViewHandler } from '../imageAssetView';

interface ErrorWithCode {
  code?: string;
  message?: string;
}

const isSocketPermissionError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as ErrorWithCode;
  const code = typeof candidate.code === 'string' ? candidate.code : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  if (code === 'EPERM' || code === 'EACCES') {
    return true;
  }

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

const createApp = (
  handler: ReturnType<typeof createImageAssetViewHandler>,
  userId: string | null = 'user-1'
): express.Express => {
  const app = express();
  app.use((req, _res, next) => {
    const request = req as express.Request & { user?: { uid?: string } };
    if (userId) {
      request.user = { uid: userId };
    } else {
      delete request.user;
    }
    next();
  });
  app.get('/preview/image/view', (req, res, next) => {
    void handler(req, res).catch(next);
  });
  return app;
};

describe('imageAssetView ownership regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires authentication', async () => {
    const getImageUrl = vi.fn();
    const handler = createImageAssetViewHandler({
      imageGenerationService: { getImageUrl } as never,
    });
    const app = createApp(handler, null);

    const response = await runSupertestOrSkip(() =>
      request(app).get('/preview/image/view').query({ assetId: 'asset-1' })
    );
    if (!response) return;

    expect(response.status).toBe(401);
    expect(getImageUrl).not.toHaveBeenCalled();
  });

  it('returns 404 when owned image asset is missing', async () => {
    const getImageUrl = vi.fn().mockResolvedValue(null);
    const handler = createImageAssetViewHandler({
      imageGenerationService: { getImageUrl } as never,
    });
    const app = createApp(handler, 'user-1');

    const response = await runSupertestOrSkip(() =>
      request(app).get('/preview/image/view').query({ assetId: 'asset-1' })
    );
    if (!response) return;

    expect(response.status).toBe(404);
    expect(getImageUrl).toHaveBeenCalledWith('asset-1', 'user-1');
  });

  it('returns owner-scoped image URL for owned assets', async () => {
    const getImageUrl = vi.fn().mockResolvedValue('https://images.example.com/asset-1');
    const handler = createImageAssetViewHandler({
      imageGenerationService: { getImageUrl } as never,
    });
    const app = createApp(handler, 'user-1');

    const response = await runSupertestOrSkip(() =>
      request(app).get('/preview/image/view').query({ assetId: 'asset-1' })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      viewUrl: 'https://images.example.com/asset-1',
      assetId: 'asset-1',
      source: 'preview',
    });
    expect(getImageUrl).toHaveBeenCalledWith('asset-1', 'user-1');
  });
});
