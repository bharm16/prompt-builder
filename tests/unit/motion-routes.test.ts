import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  depthServiceMock,
  getGCSStorageServiceMock,
  createDepthEstimationServiceForUserMock,
  getDepthWarmupStatusMock,
  getStartupWarmupPromiseMock,
} = vi.hoisted(() => {
  const depthServiceMock = {
    isAvailable: vi.fn(),
    estimateDepth: vi.fn(),
  };

  return {
    depthServiceMock,
    getGCSStorageServiceMock: vi.fn(),
    createDepthEstimationServiceForUserMock: vi.fn(() => depthServiceMock),
    getDepthWarmupStatusMock: vi.fn(),
    getStartupWarmupPromiseMock: vi.fn(),
  };
});

vi.mock('@services/convergence/storage', () => ({
  getGCSStorageService: getGCSStorageServiceMock,
}));

vi.mock('@services/convergence/depth', () => ({
  createDepthEstimationServiceForUser: createDepthEstimationServiceForUserMock,
  getDepthWarmupStatus: getDepthWarmupStatusMock,
  getStartupWarmupPromise: getStartupWarmupPromiseMock,
}));

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createMotionRoutes } from '@routes/motion.routes';
import { CAMERA_PATHS } from '@services/convergence/constants';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const TEST_API_KEY = 'motion-test-key';
let previousAllowedApiKeys: string | undefined;

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/motion', apiAuthMiddleware, createMotionRoutes());
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.path });
  });
  return app;
};

describe('motion.routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    process.env.ALLOWED_API_KEYS = TEST_API_KEY;

    getGCSStorageServiceMock.mockReturnValue({ id: 'storage-service' });
    depthServiceMock.isAvailable.mockReturnValue(true);
    depthServiceMock.estimateDepth.mockResolvedValue('https://example.com/depth.png');
    getStartupWarmupPromiseMock.mockReturnValue(null);
    getDepthWarmupStatusMock.mockReturnValue({
      warmupInFlight: false,
      lastWarmupAt: Date.now(),
    });
  });

  afterEach(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
      return;
    }
    process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
  });

  it('returns 400 for invalid depth requests', async () => {
    const app = createTestApp();
    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/motion/depth')
        .set('x-api-key', TEST_API_KEY)
        .send({})
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(createDepthEstimationServiceForUserMock).not.toHaveBeenCalled();
  });

  it('falls back when depth estimation is unavailable', async () => {
    depthServiceMock.isAvailable.mockReturnValue(false);

    const app = createTestApp();
    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/motion/depth')
        .set('x-api-key', TEST_API_KEY)
        .send({ imageUrl: 'https://example.com/keyframe.png' })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      depthMapUrl: null,
      fallbackMode: true,
    });
    expect(response.body.data.cameraPaths).toEqual(CAMERA_PATHS);
  });

  it('returns a depth map when estimation succeeds', async () => {
    const app = createTestApp();
    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/motion/depth')
        .set('x-api-key', TEST_API_KEY)
        .send({ imageUrl: 'https://example.com/keyframe.png' })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      depthMapUrl: 'https://example.com/depth.png',
      fallbackMode: false,
    });
    expect(response.body.data.cameraPaths).toEqual(CAMERA_PATHS);
  });

  it('falls back when depth estimation throws', async () => {
    depthServiceMock.estimateDepth.mockRejectedValue(new Error('depth failed'));

    const app = createTestApp();
    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/motion/depth')
        .set('x-api-key', TEST_API_KEY)
        .send({ imageUrl: 'https://example.com/keyframe.png' })
    );
    if (!response) return;

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.depthMapUrl).toBeNull();
    expect(response.body.data.fallbackMode).toBe(true);
  });

  it('returns 404 for removed convergence routes', async () => {
    const app = createTestApp();
    const response = await runSupertestOrSkip(() =>
      request(app)
        .get('/api/convergence/start')
        .set('x-api-key', TEST_API_KEY)
    );
    if (!response) return;

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Not found');
  });
});
