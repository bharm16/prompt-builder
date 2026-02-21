import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  depthServiceMock,
  getStorageServiceMock,
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
    getStorageServiceMock: vi.fn(),
    createDepthEstimationServiceForUserMock: vi.fn(() => depthServiceMock),
    getDepthWarmupStatusMock: vi.fn(),
    getStartupWarmupPromiseMock: vi.fn(),
  };
});

vi.mock('@services/convergence/depth', () => ({
  createDepthEstimationServiceForUser: createDepthEstimationServiceForUserMock,
  getDepthWarmupStatus: getDepthWarmupStatusMock,
  getStartupWarmupPromise: getStartupWarmupPromiseMock,
}));

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createMotionRoutes } from '@routes/motion.routes';
import { CAMERA_PATHS } from '@services/convergence/constants';

const TEST_API_KEY = 'integration-motion-key';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/motion',
    apiAuthMiddleware,
    createMotionRoutes({
      cameraPaths: CAMERA_PATHS,
      createDepthEstimationServiceForUser: createDepthEstimationServiceForUserMock,
      getDepthWarmupStatus: getDepthWarmupStatusMock,
      getStartupWarmupPromise: getStartupWarmupPromiseMock,
      getStorageService: getStorageServiceMock,
    })
  );
  return app;
}

describe('Motion Routes (integration)', () => {
  let previousAllowedApiKeys: string | undefined;

  beforeEach(() => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
    vi.clearAllMocks();

    getStorageServiceMock.mockReturnValue({ id: 'storage-service' });
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

  it('returns depth map data for valid requests', async () => {
    const app = createApp();

    const response = await request(app)
      .post('/api/motion/depth')
      .set('x-api-key', TEST_API_KEY)
      .send({ imageUrl: 'https://example.com/keyframe.png' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      depthMapUrl: 'https://example.com/depth.png',
      fallbackMode: false,
    });
    expect(response.body.data.cameraPaths).toEqual(CAMERA_PATHS);
  });

  it('returns fallback motion data when depth service is unavailable', async () => {
    depthServiceMock.isAvailable.mockReturnValue(false);
    const app = createApp();

    const response = await request(app)
      .post('/api/motion/depth')
      .set('x-api-key', TEST_API_KEY)
      .send({ imageUrl: 'https://example.com/keyframe.png' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      depthMapUrl: null,
      fallbackMode: true,
    });
    expect(response.body.data.cameraPaths).toEqual(CAMERA_PATHS);
  });

  it('returns validation and auth failures for invalid requests', async () => {
    const app = createApp();

    const invalidResponse = await request(app)
      .post('/api/motion/depth')
      .set('x-api-key', TEST_API_KEY)
      .send({});

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.success).toBe(false);
    expect(createDepthEstimationServiceForUserMock).not.toHaveBeenCalled();

    const noAuthResponse = await request(app)
      .post('/api/motion/depth')
      .send({ imageUrl: 'https://example.com/keyframe.png' });

    expect(noAuthResponse.status).toBe(401);
    expect(noAuthResponse.body.error).toBe('Authentication required');
  });
});
