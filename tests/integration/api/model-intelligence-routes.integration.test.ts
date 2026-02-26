import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const metricsServiceMock = vi.hoisted(() => ({
  recordModelRecommendationEvent: vi.fn(),
  recordModelRecommendationTimeToGeneration: vi.fn(),
}));

vi.mock('@infrastructure/MetricsService', () => ({
  metricsService: metricsServiceMock,
}));

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createModelIntelligenceRoutes } from '@routes/model-intelligence.routes';

const TEST_API_KEY = 'integration-model-intelligence-key';
const TEST_USER_ID = `api-key:${TEST_API_KEY}`;

function createApp() {
  const modelIntelligenceService = {
    getRecommendation: vi.fn().mockResolvedValue({
      modelId: 'sora-2',
      reason: 'Best for cinematic movement',
      confidence: 0.91,
    }),
  };

  const app = express();
  app.use(express.json());
  app.use('/api', apiAuthMiddleware, createModelIntelligenceRoutes(modelIntelligenceService as never));

  return { app, modelIntelligenceService };
}

describe('Model Intelligence Routes (integration)', () => {
  let previousAllowedApiKeys: string | undefined;

  beforeEach(() => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
      return;
    }
    process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
  });

  it('returns model recommendations for valid payloads', async () => {
    const { app, modelIntelligenceService } = createApp();

    const response = await request(app)
      .post('/api/model-intelligence/recommend')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: 'Tracking shot of a runner moving through foggy alley',
        mode: 't2v',
        spans: [{ text: 'runner', role: 'subject.identity', confidence: 0.9 }],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.modelId).toBe('sora-2');
    expect(modelIntelligenceService.getRecommendation).toHaveBeenCalledWith(
      'Tracking shot of a runner moving through foggy alley',
      expect.objectContaining({
        mode: 't2v',
        userId: TEST_USER_ID,
      })
    );
  });

  it('tracks recommendation telemetry events', async () => {
    const { app } = createApp();

    const response = await request(app)
      .post('/api/model-intelligence/track')
      .set('x-api-key', TEST_API_KEY)
      .send({
        event: 'generation_started',
        recommendationId: 'rec_1',
        promptId: 'prompt_1',
        recommendedModelId: 'sora-2',
        selectedModelId: 'sora-2',
        mode: 't2v',
        timeSinceRecommendationMs: 650,
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(metricsServiceMock.recordModelRecommendationEvent).toHaveBeenCalledWith(
      'generation_started',
      't2v',
      true
    );
    expect(metricsServiceMock.recordModelRecommendationTimeToGeneration).toHaveBeenCalledWith(
      650,
      true
    );
  });

  it('returns request/auth validation failures', async () => {
    const { app, modelIntelligenceService } = createApp();

    const invalidRecommendResponse = await request(app)
      .post('/api/model-intelligence/recommend')
      .set('x-api-key', TEST_API_KEY)
      .send({ mode: 't2v' });

    expect(invalidRecommendResponse.status).toBe(400);
    expect(invalidRecommendResponse.body.success).toBe(false);
    expect(modelIntelligenceService.getRecommendation).not.toHaveBeenCalled();

    const invalidTrackResponse = await request(app)
      .post('/api/model-intelligence/track')
      .set('x-api-key', TEST_API_KEY)
      .send({ mode: 't2v' });

    expect(invalidTrackResponse.status).toBe(400);
    expect(invalidTrackResponse.body.success).toBe(false);

    const noAuthResponse = await request(app)
      .post('/api/model-intelligence/recommend')
      .send({ prompt: 'unauthorized request' });

    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.body.error).toBe('Authentication required');
  });
});

