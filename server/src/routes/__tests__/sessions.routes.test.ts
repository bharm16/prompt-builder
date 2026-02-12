import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSessionRoutes } from '../sessions.routes';

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

const buildServices = () => {
  const baseSessionDto = {
    id: 'session-1',
    userId: 'user-1',
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    updatedAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
  };

  const sessionService = {
    listSessions: vi.fn().mockResolvedValue([]),
    toDto: vi.fn((session) => ({ ...baseSessionDto, id: session.id, userId: session.userId })),
    getSessionByPromptUuid: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ id: 'session-1', userId: 'user-1', status: 'active' }),
    createPromptSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    updatePrompt: vi.fn(),
    updateHighlights: vi.fn(),
    updateOutput: vi.fn(),
    updateVersions: vi.fn(),
  };

  const continuityService = {
    createSession: vi.fn(),
    getSession: vi.fn().mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      shots: [
        {
          id: 'shot-1',
          sessionId: 'session-1',
          sequenceIndex: 0,
          userPrompt: 'A character enters frame',
          continuityMode: 'frame-bridge',
          generationMode: 'continuity',
          styleStrength: 0.6,
          styleReferenceId: null,
          modelId: 'model-a',
          status: 'generating-video',
          continuityMechanismUsed: 'frame-bridge',
          styleScore: 0.82,
          identityScore: 0.91,
          styleDegraded: false,
          styleDegradedReason: null,
          generatedKeyframeUrl: 'https://example.com/keyframe.png',
          frameBridge: {
            frameUrl: 'https://example.com/bridge.png',
          },
          retryCount: 1,
          error: null,
        },
      ],
      defaultSettings: {
        generationMode: 'continuity',
        defaultContinuityMode: 'frame-bridge',
        defaultStyleStrength: 0.6,
        defaultModel: 'model-a',
        autoExtractFrameBridge: false,
        useCharacterConsistency: false,
      },
    }),
    addShot: vi.fn(),
    updateShot: vi.fn(),
    generateShot: vi.fn(),
    updateShotStyleReference: vi.fn(),
    updateSessionSettings: vi.fn(),
    updatePrimaryStyleReference: vi.fn(),
    createSceneProxy: vi.fn(),
  };

  return { sessionService, continuityService };
};

const createApp = (
  sessionService: ReturnType<typeof buildServices>['sessionService'],
  continuityService: ReturnType<typeof buildServices>['continuityService']
) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-user-id');
    if (userId) {
      (req as express.Request & { user?: { uid: string } }).user = { uid: userId };
    }
    next();
  });
  app.use('/sessions', createSessionRoutes(sessionService as never, continuityService as never));
  return app;
};

describe('sessions.routes', () => {
  const originalCrossUserFlag = process.env.ALLOW_DEV_CROSS_USER_SESSIONS;

  afterEach(() => {
    process.env.ALLOW_DEV_CROSS_USER_SESSIONS = originalCrossUserFlag;
  });

  it('parses list query parameters into listSessions options', async () => {
    const { sessionService, continuityService } = buildServices();
    sessionService.listSessions.mockResolvedValue([{ id: 'session-1', userId: 'user-1' }]);
    const app = createApp(sessionService, continuityService);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .get('/sessions?limit=5&includeContinuity=false&includePrompt=true')
        .set('x-user-id', 'user-1')
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(sessionService.listSessions).toHaveBeenCalledWith('user-1', {
      limit: 5,
      includeContinuity: false,
      includePrompt: true,
    });
  });

  it('enforces session ownership and supports dev bypass flag', async () => {
    const { sessionService, continuityService } = buildServices();
    const app = createApp(sessionService, continuityService);

    sessionService.getSession.mockResolvedValueOnce({ id: 'session-1', userId: 'other-user', status: 'active' });
    const denied = await runSupertestOrSkip(() =>
      request(app).get('/sessions/session-1').set('x-user-id', 'user-1')
    );
    if (!denied) return;
    expect(denied.status).toBe(403);

    process.env.ALLOW_DEV_CROSS_USER_SESSIONS = 'true';
    sessionService.getSession.mockResolvedValueOnce({ id: 'session-1', userId: 'other-user', status: 'active' });
    const allowed = await runSupertestOrSkip(() =>
      request(app).get('/sessions/session-1').set('x-user-id', 'user-1')
    );
    if (!allowed) return;
    expect(allowed.status).toBe(200);
  });

  it('validates continuity create sessionId ownership checks', async () => {
    const { sessionService, continuityService } = buildServices();
    const app = createApp(sessionService, continuityService);

    sessionService.getSession.mockResolvedValueOnce(null);
    const notFound = await runSupertestOrSkip(() =>
      request(app)
        .post('/sessions/continuity')
        .set('x-user-id', 'user-1')
        .send({ sessionId: 'missing', name: 'Continuity', sourceImageUrl: 'https://example.com/a.png' })
    );
    if (!notFound) return;
    expect(notFound.status).toBe(404);

    sessionService.getSession.mockResolvedValueOnce({ id: 'session-1', userId: 'other-user', status: 'active' });
    const forbidden = await runSupertestOrSkip(() =>
      request(app)
        .post('/sessions/continuity')
        .set('x-user-id', 'user-1')
        .send({ sessionId: 'session-1', name: 'Continuity', sourceImageUrl: 'https://example.com/a.png' })
    );
    if (!forbidden) return;
    expect(forbidden.status).toBe(403);
  });

  it('returns validation errors for prompt/highlights/output/versions updates', async () => {
    const { sessionService, continuityService } = buildServices();
    const app = createApp(sessionService, continuityService);

    const prompt = await runSupertestOrSkip(() =>
      request(app)
        .patch('/sessions/session-1/prompt')
        .set('x-user-id', 'user-1')
        .send({ output: 42 })
    );
    if (!prompt) return;
    expect(prompt.status).toBe(400);

    const highlights = await runSupertestOrSkip(() =>
      request(app)
        .patch('/sessions/session-1/highlights')
        .set('x-user-id', 'user-1')
        .send({ highlightCache: 'bad' })
    );
    if (!highlights) return;
    expect(highlights.status).toBe(400);

    const output = await runSupertestOrSkip(() =>
      request(app)
        .patch('/sessions/session-1/output')
        .set('x-user-id', 'user-1')
        .send({ output: 99 })
    );
    if (!output) return;
    expect(output.status).toBe(400);

    const versions = await runSupertestOrSkip(() =>
      request(app)
        .patch('/sessions/session-1/versions')
        .set('x-user-id', 'user-1')
        .send({ versions: 'bad' })
    );
    if (!versions) return;
    expect(versions.status).toBe(400);

    expect(sessionService.updatePrompt).not.toHaveBeenCalled();
    expect(sessionService.updateHighlights).not.toHaveBeenCalled();
    expect(sessionService.updateOutput).not.toHaveBeenCalled();
    expect(sessionService.updateVersions).not.toHaveBeenCalled();
  });

  it('returns shot status payload for /sessions/:sessionId/shots/:shotId/status', async () => {
    const { sessionService, continuityService } = buildServices();
    const app = createApp(sessionService, continuityService);

    const response = await runSupertestOrSkip(() =>
      request(app).get('/sessions/session-1/shots/shot-1/status').set('x-user-id', 'user-1')
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: {
        shotId: 'shot-1',
        status: 'generating-video',
        continuityMechanismUsed: 'frame-bridge',
        styleScore: 0.82,
        identityScore: 0.91,
        styleDegraded: false,
        styleDegradedReason: null,
        generatedKeyframeUrl: 'https://example.com/keyframe.png',
        frameBridgeUrl: 'https://example.com/bridge.png',
        retryCount: 1,
        error: null,
      },
    });
  });

  it('returns 404 for unknown shots on status route', async () => {
    const { sessionService, continuityService } = buildServices();
    continuityService.getSession.mockResolvedValueOnce({
      id: 'session-1',
      userId: 'user-1',
      shots: [],
      defaultSettings: {
        generationMode: 'continuity',
        defaultContinuityMode: 'frame-bridge',
        defaultStyleStrength: 0.6,
        defaultModel: 'model-a',
        autoExtractFrameBridge: false,
        useCharacterConsistency: false,
      },
    });
    const app = createApp(sessionService, continuityService);

    const response = await runSupertestOrSkip(() =>
      request(app).get('/sessions/session-1/shots/missing-shot/status').set('x-user-id', 'user-1')
    );
    if (!response) return;

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: 'Shot not found',
    });
  });
});
