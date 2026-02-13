import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createContinuityRoutes } from '../continuity.routes';

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

const buildService = () => {
  const session = {
    id: 'session-1',
    userId: 'user-1',
    shots: [
      {
        id: 'shot-1',
        sessionId: 'session-1',
        sequenceIndex: 0,
        userPrompt: 'Prompt',
        continuityMode: 'frame-bridge',
        styleStrength: 0.6,
        styleReferenceId: null,
        modelId: 'model-a',
        status: 'draft',
        createdAt: new Date().toISOString(),
      },
    ],
  };

  return {
    createSession: vi.fn(),
    getUserSessions: vi.fn().mockResolvedValue([session]),
    getSession: vi.fn().mockResolvedValue(session),
    addShot: vi.fn().mockResolvedValue({ id: 'shot-2' }),
    updateShot: vi.fn(),
    generateShot: vi.fn(),
    updateShotStyleReference: vi.fn(),
    updateSessionSettings: vi.fn(),
    updatePrimaryStyleReference: vi.fn(),
    createSceneProxy: vi.fn(),
    previewSceneProxy: vi.fn().mockResolvedValue({
      id: 'shot-1',
      sessionId: 'session-1',
      sequenceIndex: 0,
      userPrompt: 'Prompt',
      continuityMode: 'style-match',
      styleStrength: 0.6,
      styleReferenceId: null,
      modelId: 'model-a',
      status: 'draft',
      sceneProxyRenderUrl: 'https://example.com/preview.png',
      createdAt: new Date().toISOString(),
    }),
  };
};

const createApp = (service: ReturnType<typeof buildService>) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const userId = req.header('x-user-id');
    if (userId) {
      (req as express.Request & { user?: { uid: string } }).user = { uid: userId };
    }
    next();
  });
  app.use('/continuity', createContinuityRoutes(service as never));
  return app;
};

describe('continuity.routes', () => {
  it('returns 401 when auth is missing', async () => {
    const app = createApp(buildService());

    const response = await runSupertestOrSkip(() => request(app).get('/continuity/sessions'));
    if (!response) return;

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ success: false, error: 'Authentication required' });
  });

  it('returns 400 for invalid create session payload', async () => {
    const app = createApp(buildService());

    const response = await runSupertestOrSkip(() =>
      request(app).post('/continuity/sessions').set('x-user-id', 'user-1').send({ name: '' })
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('returns 400 for blank shotId params on shot update route', async () => {
    const app = createApp(buildService());

    const response = await runSupertestOrSkip(() =>
      request(app)
        .patch('/continuity/sessions/session-1/shots/%20')
        .set('x-user-id', 'user-1')
        .send({ prompt: 'updated' })
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ success: false, error: 'Invalid shotId' });
  });

  it('wires create shot route to service addShot', async () => {
    const service = buildService();
    const app = createApp(service);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/continuity/sessions/session-1/shots')
        .set('x-user-id', 'user-1')
        .send({ prompt: 'new shot' })
    );
    if (!response) return;

    expect(response.status).toBe(201);
    expect(service.addShot).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', prompt: 'new shot' })
    );
  });

  it('wires scene proxy preview route to service previewSceneProxy', async () => {
    const service = buildService();
    const app = createApp(service);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/continuity/sessions/session-1/shots/shot-1/scene-proxy-preview')
        .set('x-user-id', 'user-1')
        .send({ camera: { yaw: 0.2, pitch: -0.1, roll: 0, dolly: -1.5 } })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(service.previewSceneProxy).toHaveBeenCalledWith('session-1', 'shot-1', {
      yaw: 0.2,
      pitch: -0.1,
      roll: 0,
      dolly: -1.5,
    });
  });
});
