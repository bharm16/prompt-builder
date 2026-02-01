import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('videoGenerate motion guidance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserIdMock.mockResolvedValue('user-123');
  });

  it('appends camera and subject motion guidance to the queued prompt', async () => {
    const createJobMock = vi.fn(async (payload: Record<string, unknown>) => ({
      id: 'job-1',
      status: 'queued',
      ...payload,
    }));

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
        prompt: 'A cinematic shot of a runner at dawn.',
        model: 'sora-2',
        generationParams: {
          camera_motion_id: 'pan_left',
          subject_motion: 'running steadily toward the horizon',
        },
      });

    expect(response.status).toBe(202);
    expect(createJobMock).toHaveBeenCalledTimes(1);

    const jobPayload = createJobMock.mock.calls[0]?.[0] as
      | { request?: { prompt?: string } }
      | undefined;
    const prompt = jobPayload?.request?.prompt ?? '';

    expect(prompt).toContain('Camera motion:');
    expect(prompt).toContain('Camera rotates left while staying in place');
    expect(prompt).toContain('Subject motion: running steadily toward the horizon');
  });
});
