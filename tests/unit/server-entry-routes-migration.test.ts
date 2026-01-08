import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@config/middleware.config', () => ({
  configureMiddleware: vi.fn(),
}));

vi.mock('@config/routes.config', () => ({
  configureRoutes: vi.fn(),
}));

vi.mock('@services/quality-feedback/services/LLMJudgeService', () => ({
  LLMJudgeService: class {
    async evaluateSuggestions() {
      return {
        overallScore: 87,
        rubricScores: {},
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: 'ok',
        metadata: { rubricUsed: 'test' },
      };
    }

    async evaluateSingleSuggestion() {
      return {
        overallScore: 91,
        rubricScores: {},
        feedback: [],
        strengths: [],
        weaknesses: [],
        detailedNotes: 'single',
        metadata: { rubricUsed: 'test' },
      };
    }

    async compareSuggestionSets() {
      return {
        setA: { overallScore: 80, rubricScores: {}, metadata: { rubricUsed: 'test' } },
        setB: { overallScore: 70, rubricScores: {}, metadata: { rubricUsed: 'test' } },
        winner: 'A',
        scoreDifference: 10,
        criteriaComparison: {},
      };
    }
  },
}));

import * as middlewareConfig from '@config/middleware.config';
import * as routesConfig from '@config/routes.config';
import { createApp } from '@server/app';
import { startServer } from '@server/server';
import { createHealthRoutes } from '@routes/health.routes';
import { createAPIRoutes } from '@routes/api.routes';
import { createSuggestionsRoute } from '@routes/suggestions';
import type { AIModelService } from '@services/ai-model/AIModelService';

describe('createApp', () => {
  it('sets trust proxy and wires middleware/routes', () => {
    const configureMiddleware = vi.mocked(middlewareConfig.configureMiddleware);
    const configureRoutes = vi.mocked(routesConfig.configureRoutes);
    const container = {
      resolve: vi.fn((key: string) => {
        if (key === 'logger') return { name: 'logger' };
        if (key === 'metricsService') return { name: 'metrics' };
        return null;
      }),
    };

    const app = createApp(container as never);

    expect(app.get('trust proxy')).toBe(1);
    expect(configureMiddleware).toHaveBeenCalledWith(app, {
      logger: { name: 'logger' },
      metricsService: { name: 'metrics' },
    });
    expect(configureRoutes).toHaveBeenCalledWith(app, container);
  });
});

describe('startServer', () => {
  it('starts server and sets timeouts', async () => {
    const app = express();
    const container = {
      resolve: vi.fn(() => ({
        server: {
          port: 0,
          environment: 'test',
        },
      })),
    };

    const server = await startServer(app, container as never);

    expect(server.listening).toBe(true);
    expect(server.keepAliveTimeout).toBe(125000);
    expect(server.headersTimeout).toBe(126000);

    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
});

describe('health.routes', () => {
  it('serves health, readiness, and live endpoints', async () => {
    const deps = {
      claudeClient: { getStats: () => ({ state: 'CLOSED' }) },
      groqClient: null,
      geminiClient: null,
      cacheService: {
        isHealthy: () => true,
        getCacheStats: () => ({ hits: 1, misses: 0 }),
      },
      metricsService: {
        register: { contentType: 'text/plain' },
        getMetrics: async () => 'metrics',
      },
    };

    const app = express();
    app.use(createHealthRoutes(deps));

    const health = await request(app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body.status).toBe('healthy');

    const live = await request(app).get('/health/live');
    expect(live.status).toBe(200);
    expect(live.body.status).toBe('alive');

    const ready = await request(app).get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ready');
    expect(ready.body.checks.cache.healthy).toBe(true);
    expect(ready.body.checks.openAI.healthy).toBe(true);
  });

  it('protects metrics and stats endpoints with token', async () => {
    process.env.METRICS_TOKEN = 'secret-token';

    const deps = {
      claudeClient: { getStats: () => ({ state: 'CLOSED' }) },
      groqClient: null,
      geminiClient: null,
      cacheService: {
        isHealthy: () => true,
        getCacheStats: () => ({ hits: 1, misses: 0 }),
      },
      metricsService: {
        register: { contentType: 'text/plain' },
        getMetrics: async () => 'metrics-body',
      },
    };

    const app = express();
    app.use(createHealthRoutes(deps));

    const metrics = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer secret-token');
    expect(metrics.status).toBe(200);
    expect(metrics.text).toBe('metrics-body');

    const stats = await request(app)
      .get('/stats')
      .set('Authorization', 'Bearer secret-token');
    expect(stats.status).toBe(200);
    expect(stats.body.apis.openAI.state).toBe('CLOSED');
    expect(stats.body.twoStageOptimization.enabled).toBe(false);
  });
});

describe('api.routes', () => {
  it('validates and processes optimize requests', async () => {
    const promptOptimizationService = {
      optimize: vi.fn(async (_args: Record<string, unknown>) => 'optimized prompt'),
    };

    const app = express();
    app.use(express.json());
    app.use(
      createAPIRoutes({
        promptOptimizationService,
        enhancementService: {},
        sceneDetectionService: {},
        videoConceptService: {},
        metricsService: null,
      })
    );

    const badResponse = await request(app).post('/optimize').send({});
    expect(badResponse.status).toBe(400);

    const response = await request(app)
      .post('/optimize')
      .send({ prompt: 'Hello world' });

    expect(response.status).toBe(200);
    expect(response.body.optimizedPrompt).toBe('optimized prompt');
    expect(promptOptimizationService.optimize).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Hello world',
      mode: 'video',
      targetModel: undefined,
      context: undefined,
      brainstormContext: undefined,
      skipCache: false,
    }));
    const optimizeArgs = promptOptimizationService.optimize.mock.calls[0]?.[0];
    expect(typeof optimizeArgs?.onMetadata).toBe('function');
  });

  it('passes skipCache through optimize requests', async () => {
    const promptOptimizationService = {
      optimize: vi.fn(async (_args: Record<string, unknown>) => 'optimized prompt'),
    };

    const app = express();
    app.use(express.json());
    app.use(
      createAPIRoutes({
        promptOptimizationService,
        enhancementService: {},
        sceneDetectionService: {},
        videoConceptService: {},
        metricsService: null,
      })
    );

    const response = await request(app)
      .post('/optimize')
      .send({ prompt: 'Hello world', skipCache: true });

    expect(response.status).toBe(200);
    expect(response.body.optimizedPrompt).toBe('optimized prompt');
    expect(promptOptimizationService.optimize).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Hello world',
      mode: 'video',
      targetModel: undefined,
      context: undefined,
      brainstormContext: undefined,
      skipCache: true,
    }));
    const optimizeArgs = promptOptimizationService.optimize.mock.calls[0]?.[0];
    expect(typeof optimizeArgs?.onMetadata).toBe('function');
  });

  it('passes locked spans through optimize requests', async () => {
    const promptOptimizationService = {
      optimize: vi.fn(async (_args: Record<string, unknown>) => 'optimized prompt'),
    };

    const app = express();
    app.use(express.json());
    app.use(
      createAPIRoutes({
        promptOptimizationService,
        enhancementService: {},
        sceneDetectionService: {},
        videoConceptService: {},
        metricsService: null,
      })
    );

    const response = await request(app)
      .post('/optimize')
      .send({
        prompt: 'Hello world',
        lockedSpans: [
          {
            id: 'span_1',
            text: 'neon alley',
            leftCtx: 'rain-soaked ',
            rightCtx: ' at night',
          },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.optimizedPrompt).toBe('optimized prompt');
    expect(promptOptimizationService.optimize).toHaveBeenCalledWith(expect.objectContaining({
      prompt: 'Hello world',
      lockedSpans: [
        {
          id: 'span_1',
          text: 'neon alley',
          leftCtx: 'rain-soaked ',
          rightCtx: ' at night',
        },
      ],
    }));
    const optimizeArgs = promptOptimizationService.optimize.mock.calls[0]?.[0];
    expect(typeof optimizeArgs?.onMetadata).toBe('function');
  });
});

describe('suggestions.routes', () => {
  it('validates suggestion evaluation payloads', async () => {
    const app = express();
    app.use(express.json());
    const aiService = {} as AIModelService;
    app.use(createSuggestionsRoute(aiService));

    const invalid = await request(app).post('/evaluate').send({
      suggestions: [],
      context: { highlightedText: 'test' },
    });

    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toContain('suggestions');
  });

  it('returns evaluation results for valid requests', async () => {
    const app = express();
    app.use(express.json());
    const aiService = {} as AIModelService;
    app.use(createSuggestionsRoute(aiService));

    const response = await request(app).post('/evaluate').send({
      suggestions: [{ text: 'Better phrasing' }],
      context: { highlightedText: 'Original text', isVideoPrompt: true },
    });

    expect(response.status).toBe(200);
    expect(response.body.evaluation.overallScore).toBe(87);
    expect(typeof response.body.responseTime).toBe('number');
  });

  it('supports single and compare evaluation endpoints', async () => {
    const app = express();
    app.use(express.json());
    const aiService = {} as AIModelService;
    app.use(createSuggestionsRoute(aiService));

    const single = await request(app).post('/evaluate/single').send({
      suggestion: 'One option',
      context: { highlightedText: 'Original text' },
    });

    expect(single.status).toBe(200);
    expect(single.body.evaluation.overallScore).toBe(91);

    const compare = await request(app).post('/evaluate/compare').send({
      setA: [{ text: 'A' }],
      setB: [{ text: 'B' }],
      context: { highlightedText: 'Original text' },
    });

    expect(compare.status).toBe(200);
    expect(compare.body.comparison.winner).toBe('A');
  });

  it('exposes rubric definitions', async () => {
    const app = express();
    const aiService = {} as AIModelService;
    app.use(createSuggestionsRoute(aiService));

    const response = await request(app).get('/rubrics');

    expect(response.status).toBe(200);
    expect(response.body.rubrics).toHaveProperty('video');
    expect(response.body.rubrics).toHaveProperty('general');
  });
});
