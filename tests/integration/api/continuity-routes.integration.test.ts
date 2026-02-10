import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createContinuityRoutes } from '@routes/continuity.routes';

const TEST_API_KEY = 'integration-continuity-key';
const TEST_USER_ID = `api-key:${TEST_API_KEY}`;

function buildContinuitySession() {
  return {
    id: 'continuity_session_1',
    userId: TEST_USER_ID,
    name: 'Storyboard session',
    shots: [
      {
        id: 'shot_1',
        prompt: 'A character enters frame',
        continuityMode: 'style-match',
        generationMode: 'continuity',
        modelId: 'sora2',
      },
    ],
    defaultSettings: {
      generationMode: 'continuity',
      defaultContinuityMode: 'style-match',
      defaultModel: 'sora2',
      maxRetries: 1,
      useCharacterConsistency: false,
    },
  };
}

function createApp() {
  const continuitySession = buildContinuitySession();

  const continuityService = {
    createSession: vi.fn().mockResolvedValue(continuitySession),
    getUserSessions: vi.fn().mockResolvedValue([continuitySession]),
    getSession: vi.fn().mockResolvedValue(continuitySession),
    addShot: vi.fn().mockResolvedValue({ id: 'shot_2', prompt: 'new shot' }),
    updateShot: vi.fn().mockResolvedValue({ id: 'shot_1', prompt: 'updated shot' }),
    generateShot: vi.fn().mockResolvedValue({
      status: 'completed',
      assetId: 'asset_1',
      retryCount: 0,
    }),
    updateShotStyleReference: vi.fn().mockResolvedValue({ id: 'shot_1', styleReferenceId: null }),
    updateSessionSettings: vi.fn().mockResolvedValue({
      ...continuitySession,
      defaultSettings: {
        ...continuitySession.defaultSettings,
        generationMode: 'standard',
      },
    }),
    updatePrimaryStyleReference: vi.fn().mockResolvedValue(continuitySession),
    createSceneProxy: vi.fn().mockResolvedValue(continuitySession),
  };

  const userCreditService = {
    reserveCredits: vi.fn().mockResolvedValue(true),
    refundCredits: vi.fn().mockResolvedValue(true),
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/continuity',
    apiAuthMiddleware,
    createContinuityRoutes(continuityService as never, userCreditService as never)
  );

  return { app, continuityService, userCreditService };
}

describe('Continuity Routes (integration)', () => {
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

  it('creates and lists continuity sessions', async () => {
    const { app, continuityService } = createApp();

    const createResponse = await request(app)
      .post('/api/continuity/sessions')
      .set('x-api-key', TEST_API_KEY)
      .send({
        name: 'Storyline continuity',
      });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.success).toBe(true);
    expect(continuityService.createSession).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({ name: 'Storyline continuity' })
    );

    const listResponse = await request(app)
      .get('/api/continuity/sessions')
      .set('x-api-key', TEST_API_KEY);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.success).toBe(true);
    expect(continuityService.getUserSessions).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it('runs shot lifecycle endpoints (create, update, generate)', async () => {
    const { app, continuityService, userCreditService } = createApp();

    const createShotResponse = await request(app)
      .post('/api/continuity/sessions/continuity_session_1/shots')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: 'A character exits frame',
        continuityMode: 'style-match',
      });
    expect(createShotResponse.status).toBe(201);
    expect(createShotResponse.body.success).toBe(true);
    expect(continuityService.addShot).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'continuity_session_1',
        prompt: 'A character exits frame',
      })
    );

    const updateShotResponse = await request(app)
      .patch('/api/continuity/sessions/continuity_session_1/shots/shot_1')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: 'Updated shot prompt',
      });
    expect(updateShotResponse.status).toBe(200);
    expect(updateShotResponse.body.success).toBe(true);
    expect(continuityService.updateShot).toHaveBeenCalledWith(
      'continuity_session_1',
      'shot_1',
      expect.objectContaining({ prompt: 'Updated shot prompt' })
    );

    const generateShotResponse = await request(app)
      .post('/api/continuity/sessions/continuity_session_1/shots/shot_1/generate')
      .set('x-api-key', TEST_API_KEY)
      .send({});
    expect(generateShotResponse.status).toBe(200);
    expect(generateShotResponse.body.success).toBe(true);
    expect(userCreditService.reserveCredits).toHaveBeenCalled();
    expect(continuityService.generateShot).toHaveBeenCalledWith('continuity_session_1', 'shot_1');
  });

  it('updates style references, session settings, and scene proxy', async () => {
    const { app, continuityService } = createApp();

    const styleReferenceResponse = await request(app)
      .put('/api/continuity/sessions/continuity_session_1/shots/shot_1/style-reference')
      .set('x-api-key', TEST_API_KEY)
      .send({ styleReferenceId: null });
    expect(styleReferenceResponse.status).toBe(200);
    expect(continuityService.updateShotStyleReference).toHaveBeenCalledWith(
      'continuity_session_1',
      'shot_1',
      null
    );

    const settingsResponse = await request(app)
      .put('/api/continuity/sessions/continuity_session_1/settings')
      .set('x-api-key', TEST_API_KEY)
      .send({
        settings: {
          generationMode: 'standard',
        },
      });
    expect(settingsResponse.status).toBe(200);
    expect(continuityService.updateSessionSettings).toHaveBeenCalledWith(
      'continuity_session_1',
      expect.objectContaining({
        generationMode: 'standard',
      })
    );

    const primaryStyleResponse = await request(app)
      .put('/api/continuity/sessions/continuity_session_1/style-reference')
      .set('x-api-key', TEST_API_KEY)
      .send({
        sourceImageUrl: 'https://example.com/style.png',
      });
    expect(primaryStyleResponse.status).toBe(200);
    expect(continuityService.updatePrimaryStyleReference).toHaveBeenCalledWith(
      'continuity_session_1',
      undefined,
      'https://example.com/style.png'
    );

    const sceneProxyResponse = await request(app)
      .post('/api/continuity/sessions/continuity_session_1/scene-proxy')
      .set('x-api-key', TEST_API_KEY)
      .send({
        sourceShotId: 'shot_1',
      });
    expect(sceneProxyResponse.status).toBe(201);
    expect(continuityService.createSceneProxy).toHaveBeenCalledWith(
      'continuity_session_1',
      'shot_1',
      undefined
    );
  });

  it('returns request/auth validation failures', async () => {
    const { app, continuityService } = createApp();

    const invalidResponse = await request(app)
      .post('/api/continuity/sessions')
      .set('x-api-key', TEST_API_KEY)
      .send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(continuityService.createSession).not.toHaveBeenCalled();

    const noAuthResponse = await request(app)
      .post('/api/continuity/sessions')
      .send({ name: 'No auth' });

    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.body.error).toBe('Authentication required');
  });
});

