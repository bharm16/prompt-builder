import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createVideoRoutes } from '@routes/video.routes';

const TEST_API_KEY = 'integration-video-key';

function createApp() {
  const videoConceptService = {
    getCreativeSuggestions: vi.fn().mockResolvedValue({
      suggestions: ['add haze', 'use wider lens'],
    }),
    checkCompatibility: vi.fn().mockResolvedValue({
      compatible: true,
      conflicts: [],
    }),
    detectConflicts: vi.fn().mockResolvedValue({ conflicts: [] }),
    completeScene: vi.fn().mockResolvedValue({
      suggestions: [{ elementType: 'shot', value: 'wide shot' }],
    }),
    getSmartDefaults: vi.fn().mockResolvedValue({
      frameRate: '24fps',
    }),
    generateVariations: vi.fn().mockResolvedValue({
      variations: [{ id: 'var_1', text: 'variation one' }],
    }),
    parseConcept: vi.fn().mockResolvedValue({
      elements: [{ elementType: 'subject', value: 'runner' }],
    }),
  };

  const app = express();
  app.use(express.json());
  app.use('/api/video', apiAuthMiddleware, createVideoRoutes({ videoConceptService } as never));

  return { app, videoConceptService };
}

describe('Video Routes (integration)', () => {
  let previousAllowedApiKeys: string | undefined;

  beforeEach(() => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
  });

  afterEach(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
      return;
    }
    process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
  });

  it('handles suggestions/validate/complete/variations/parse happy paths', async () => {
    const { app, videoConceptService } = createApp();

    const suggestionsResponse = await request(app)
      .post('/api/video/suggestions')
      .set('x-api-key', TEST_API_KEY)
      .send({
        elementType: 'subject',
        currentValue: 'runner',
        concept: 'runner in rain',
      });
    expect(suggestionsResponse.status).toBe(200);
    expect(videoConceptService.getCreativeSuggestions).toHaveBeenCalled();

    const validateResponse = await request(app)
      .post('/api/video/validate')
      .set('x-api-key', TEST_API_KEY)
      .send({
        elementType: 'subject',
        value: 'runner',
        elements: { subject: 'runner' },
      });
    expect(validateResponse.status).toBe(200);
    expect(videoConceptService.checkCompatibility).toHaveBeenCalled();
    expect(videoConceptService.detectConflicts).toHaveBeenCalled();

    const completeResponse = await request(app)
      .post('/api/video/complete')
      .set('x-api-key', TEST_API_KEY)
      .send({
        existingElements: { subject: 'runner' },
        concept: 'runner in rain',
        smartDefaultsFor: 'technical',
      });
    expect(completeResponse.status).toBe(200);
    expect(videoConceptService.completeScene).toHaveBeenCalled();
    expect(videoConceptService.getSmartDefaults).toHaveBeenCalled();

    const variationsResponse = await request(app)
      .post('/api/video/variations')
      .set('x-api-key', TEST_API_KEY)
      .send({
        elements: { subject: 'runner' },
        concept: 'runner in rain',
      });
    expect(variationsResponse.status).toBe(200);
    expect(videoConceptService.generateVariations).toHaveBeenCalled();

    const parseResponse = await request(app)
      .post('/api/video/parse')
      .set('x-api-key', TEST_API_KEY)
      .send({
        concept: 'A runner sprinting through neon rain',
      });
    expect(parseResponse.status).toBe(200);
    expect(videoConceptService.parseConcept).toHaveBeenCalled();
  });

  it('returns validation and auth failures', async () => {
    const { app, videoConceptService } = createApp();

    const invalidResponse = await request(app)
      .post('/api/video/parse')
      .set('x-api-key', TEST_API_KEY)
      .send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toBe('Validation failed');
    expect(videoConceptService.parseConcept).not.toHaveBeenCalled();

    const noAuthResponse = await request(app)
      .post('/api/video/suggestions')
      .send({
        elementType: 'subject',
      });

    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.body.error).toBe('Authentication required');
  });
});

