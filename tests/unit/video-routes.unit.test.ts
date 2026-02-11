import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock(
  '@infrastructure/firebaseAdmin',
  () => ({
    admin: {
      auth: () => ({
        verifyIdToken: mocks.verifyIdToken,
      }),
    },
  })
);

vi.mock(
  '@infrastructure/Logger',
  () => ({
    logger: {
      info: mocks.loggerInfo,
      warn: mocks.loggerWarn,
      error: mocks.loggerError,
    },
  })
);

vi.mock(
  '@middleware/asyncHandler',
  () => ({
    asyncHandler:
      (
        fn: (
          req: express.Request,
          res: express.Response,
          next: express.NextFunction
        ) => Promise<unknown> | unknown
      ) =>
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
      },
  })
);

vi.mock(
  '@middleware/validateRequest',
  () => ({
    validateRequest:
      (schema: { safeParse?: (value: unknown) => { success: boolean; data?: unknown } }) =>
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const result = schema.safeParse ? schema.safeParse(req.body) : { success: true, data: req.body };
        if (!result.success) {
          res.status(400).json({
            error: 'Validation failed',
            details: 'Invalid request data',
          });
          return;
        }
        req.body = result.data;
        next();
      },
  })
);

vi.mock(
  '@utils/validation',
  () => ({
    creativeSuggestionSchema: z.object({
      elementType: z.string().min(1),
      currentValue: z.string().optional(),
      context: z.record(z.string(), z.unknown()).optional(),
      concept: z.string().optional(),
    }),
    videoValidationSchema: z.object({
      elements: z.record(z.string(), z.unknown()),
      elementType: z.string().optional(),
      value: z.unknown().optional(),
    }),
    completeSceneSchema: z.object({
      existingElements: z.record(z.string(), z.unknown()),
      concept: z.string().min(1),
      smartDefaultsFor: z.string().optional(),
    }),
    variationsSchema: z.object({
      elements: z.record(z.string(), z.unknown()),
      concept: z.string().min(1),
    }),
    parseConceptSchema: z.object({
      concept: z.string().min(1),
    }),
  })
);

import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createVideoRoutes } from '@routes/video.routes';
import { runSupertestOrSkip } from './test-helpers/supertestSafeRequest';

const TEST_API_KEY = 'unit-video-key';

type MockVideoConceptService = {
  getCreativeSuggestions: ReturnType<typeof vi.fn>;
  checkCompatibility: ReturnType<typeof vi.fn>;
  detectConflicts: ReturnType<typeof vi.fn>;
  completeScene: ReturnType<typeof vi.fn>;
  getSmartDefaults: ReturnType<typeof vi.fn>;
  generateVariations: ReturnType<typeof vi.fn>;
  parseConcept: ReturnType<typeof vi.fn>;
};

const createMockService = (): MockVideoConceptService => ({
  getCreativeSuggestions: vi.fn(async () => ({ suggestions: ['add haze'] })),
  checkCompatibility: vi.fn(async () => ({ compatible: true })),
  detectConflicts: vi.fn(async () => ({ conflicts: [] })),
  completeScene: vi.fn(async () => ({ suggestions: [{ elementType: 'style', value: 'noir' }] })),
  getSmartDefaults: vi.fn(async () => ({ frameRate: '24fps' })),
  generateVariations: vi.fn(async () => ({ variations: [{ text: 'variation-1' }] })),
  parseConcept: vi.fn(async () => ({ elements: [{ elementType: 'subject', value: 'runner' }] })),
});

const createApp = (service: MockVideoConceptService) => {
  const app = express();
  app.use(express.json());
  app.use('/api/video', apiAuthMiddleware, createVideoRoutes({ videoConceptService: service } as never));
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({
        error: 'Internal server error',
        message,
      });
    }
  );
  return app;
};

describe('video routes unit', () => {
  let previousAllowedApiKeys: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
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

  it('rejects unauthenticated requests with 401', async () => {
    const app = createApp(createMockService());
    const response = await runSupertestOrSkip(() =>
      request(app).post('/api/video/suggestions').send({ elementType: 'subject' })
    );
    if (!response) return;

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('returns 400 for validation failures', async () => {
    const app = createApp(createMockService());
    const response = await runSupertestOrSkip(() =>
      request(app).post('/api/video/parse').set('x-api-key', TEST_API_KEY).send({})
    );
    if (!response) return;

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('handles all concept route happy paths and delegates to service', async () => {
    const service = createMockService();
    const app = createApp(service);

    const suggestions = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/suggestions')
        .set('x-api-key', TEST_API_KEY)
        .send({ elementType: 'subject', currentValue: 'runner' })
    );
    if (!suggestions) return;
    expect(suggestions.status).toBe(200);
    expect(service.getCreativeSuggestions).toHaveBeenCalledTimes(1);

    const validate = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/validate')
        .set('x-api-key', TEST_API_KEY)
        .send({ elements: { subject: 'runner' }, elementType: 'subject', value: 'runner' })
    );
    if (!validate) return;
    expect(validate.status).toBe(200);
    expect(service.checkCompatibility).toHaveBeenCalledTimes(1);
    expect(service.detectConflicts).toHaveBeenCalledTimes(1);

    const complete = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/complete')
        .set('x-api-key', TEST_API_KEY)
        .send({ existingElements: { subject: 'runner' }, concept: 'runner in rain', smartDefaultsFor: 'technical' })
    );
    if (!complete) return;
    expect(complete.status).toBe(200);
    expect(service.completeScene).toHaveBeenCalledTimes(1);
    expect(service.getSmartDefaults).toHaveBeenCalledTimes(1);

    const variations = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/variations')
        .set('x-api-key', TEST_API_KEY)
        .send({ elements: { subject: 'runner' }, concept: 'runner in rain' })
    );
    if (!variations) return;
    expect(variations.status).toBe(200);
    expect(service.generateVariations).toHaveBeenCalledTimes(1);

    const parse = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/parse')
        .set('x-api-key', TEST_API_KEY)
        .send({ concept: 'A runner sprinting through neon rain' })
    );
    if (!parse) return;
    expect(parse.status).toBe(200);
    expect(service.parseConcept).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when service throws and asyncHandler forwards the error', async () => {
    const service = createMockService();
    service.parseConcept.mockRejectedValueOnce(new Error('parse exploded'));
    const app = createApp(service);

    const response = await runSupertestOrSkip(() =>
      request(app)
        .post('/api/video/parse')
        .set('x-api-key', TEST_API_KEY)
        .send({ concept: 'valid concept' })
    );
    if (!response) return;

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      error: 'Internal server error',
      message: 'parse exploded',
    });
  });
});
