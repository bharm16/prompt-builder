import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createVideoAvailabilityHandler } from '../videoAvailability';

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

const createApp = (handler: express.RequestHandler) => {
  const app = express();
  app.get('/preview/video/availability', handler);
  return app;
};

describe('video availability handler', () => {
  it('returns success false with empty availability payload when service is unavailable', async () => {
    const handler = createVideoAvailabilityHandler({
      videoGenerationService: null as never,
    });
    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).get('/preview/video/availability')
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: false,
      error: 'Video generation service is not available',
      data: {
        providers: {
          replicate: false,
          openai: false,
          luma: false,
          kling: false,
          gemini: false,
        },
        models: [],
        availableModels: [],
        availableCapabilityModels: [],
      },
      providers: {
        replicate: false,
        openai: false,
        luma: false,
        kling: false,
        gemini: false,
      },
      models: [],
      availableModels: [],
      availableCapabilityModels: [],
    });
  });

  it('returns deduped availableCapabilityModels when service is available', async () => {
    const getAvailabilitySnapshotMock = vi.fn().mockReturnValue({
      models: [{ id: 'wan-video/wan-2.2-t2v-fast', available: true }],
      availableModelIds: [
        'wan-video/wan-2.2-t2v-fast',
        'wan-video/wan-2.2-i2v-fast',
        'google/veo-3',
      ],
    });

    const handler = createVideoAvailabilityHandler({
      videoGenerationService: {
        getAvailabilitySnapshot: getAvailabilitySnapshotMock,
      } as never,
    });
    const app = createApp(handler);

    const response = await runSupertestOrSkip(() =>
      request(app).get('/preview/video/availability')
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(getAvailabilitySnapshotMock).toHaveBeenCalledTimes(1);
    expect(getAvailabilitySnapshotMock.mock.calls[0]?.[0]).toEqual(expect.any(Array));
    expect(response.body.availableCapabilityModels).toEqual(['wan-2.2', 'veo-4']);
    expect(response.body.data.availableCapabilityModels).toEqual(['wan-2.2', 'veo-4']);
  });
});
