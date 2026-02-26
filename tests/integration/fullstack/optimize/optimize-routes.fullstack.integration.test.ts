import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServices, initializeServices } from '@config/services.config';
import { createApp } from '@server/app';

const TEST_API_KEY = 'phase2-optimize-key';

interface MockAIResponse {
  text: string;
  content?: Array<{ text?: string }>;
  metadata: Record<string, unknown>;
}

interface MockAIService {
  execute: ReturnType<typeof vi.fn>;
  stream: ReturnType<typeof vi.fn>;
  supportsStreaming: ReturnType<typeof vi.fn>;
  getAvailableClients: ReturnType<typeof vi.fn>;
}

function parseSseEvents(ssePayload: string): Array<{ event: string; data: unknown }> {
  const chunks = ssePayload
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const events: Array<{ event: string; data: unknown }> = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim());
    let eventType = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) continue;

    const rawData = dataLines.join('\n');
    let parsed: unknown = rawData;
    try {
      parsed = JSON.parse(rawData) as unknown;
    } catch {
      // Keep raw text for non-JSON payloads.
    }

    events.push({ event: eventType, data: parsed });
  }

  return events;
}

describe('Optimize Routes (full-stack integration)', () => {
  let app: Application;
  let aiServiceMock: MockAIService;
  let failOperation: string | null = null;

  let previousAllowedApiKeys: string | undefined;
  let previousPort: string | undefined;
  let previousPromptOutputOnly: string | undefined;

  beforeAll(async () => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    previousPort = process.env.PORT;
    previousPromptOutputOnly = process.env.PROMPT_OUTPUT_ONLY;

    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
    process.env.PORT = '0';
    process.env.PROMPT_OUTPUT_ONLY = 'true';

    const makeResponse = (text: string): MockAIResponse => ({
      text,
      content: [{ text }],
      metadata: { provider: 'mock' },
    });
    const validVideoOptimizationJson = JSON.stringify({
      _creative_strategy:
        'Use wide framing and a low angle to emphasize momentum while preserving subject continuity.',
      shot_framing: 'Wide Shot',
      camera_angle: 'Low-Angle Shot',
      camera_move: 'slow tracking dolly',
      subject: 'runner',
      subject_details: ['wearing red windbreaker', 'black running shoes'],
      action: 'running through the city street',
      setting: 'rain-slick downtown street',
      time: 'golden hour',
      lighting: 'warm side light with long shadows',
      style: '35mm film noir aesthetic',
      technical_specs: {
        lighting: 'warm side light with long shadows',
        camera: 'tracking dolly, low-angle, 35mm lens, f/4',
        style: '35mm film noir aesthetic',
        aspect_ratio: '16:9',
        frame_rate: '24fps',
        duration: '6s',
        audio: 'mute',
      },
      variations: [
        {
          label: 'Higher Angle',
          prompt:
            'A Wide Shot from a High-Angle Shot with slow tracking dolly as a runner in a red windbreaker is running through a rain-slick downtown street at golden hour.',
        },
        {
          label: 'Cool Lighting',
          prompt:
            'A Wide Shot from a Low-Angle Shot with slow tracking dolly as a runner in a red windbreaker is running through a rain-slick downtown street with cool overhead lighting.',
        },
      ],
    });

    aiServiceMock = {
      execute: vi.fn(async (operation: string): Promise<MockAIResponse> => {
        if (failOperation && (failOperation === operation || failOperation === '*')) {
          throw new Error(`Synthetic ${operation} failure`);
        }

        switch (operation) {
          case 'optimize_quality_assessment':
            return makeResponse(
              JSON.stringify({
                score: 0.95,
                details: {
                  clarity: 0.95,
                  specificity: 0.95,
                  structure: 0.95,
                  completeness: 0.95,
                  actionability: 0.95,
                },
                strengths: ['clear visual direction'],
                weaknesses: [],
              })
            );
          case 'optimize_shot_interpreter':
            return makeResponse(
              JSON.stringify({
                shot_type: 'action_shot',
                core_intent: 'runner moving through scene',
                subject: 'runner',
                action: 'running',
                visual_focus: 'runner',
                setting: 'city street',
                time: 'golden hour',
                mood: 'energetic',
                style: 'cinematic',
                camera_move: 'tracking',
                camera_angle: 'eye level',
                lighting: 'warm side light',
                audio: 'ambient city noise',
                duration_hint: '4s',
                risks: [],
                confidence: 0.9,
              })
            );
          case 'optimize_context_inference':
            return makeResponse(
              JSON.stringify({
                specificAspects: 'camera movement and pacing',
                backgroundLevel: 'intermediate',
                intendedUse: 'video generation',
              })
            );
          case 'optimize_draft':
            return makeResponse(
              'A cinematic runner moves through a sunlit city street with strong motion cues.'
            );
          case 'optimize_standard':
            return makeResponse(validVideoOptimizationJson);
          case 'optimize_intent_check':
            return makeResponse(
              JSON.stringify({
                preserved: true,
                score: 0.92,
                rationale: 'Core subject and motion intent preserved',
              })
            );
          default:
            return makeResponse('ok');
        }
      }),
      stream: vi.fn(
        async (
          operation: string,
          params: {
            onChunk: (chunk: string) => void;
          }
        ): Promise<string> => {
          if (failOperation && (failOperation === operation || failOperation === '*')) {
            throw new Error(`Synthetic ${operation} stream failure`);
          }

          if (operation === 'optimize_draft') {
            params.onChunk('A cinematic runner');
            return 'A cinematic runner moves through a sunlit city street.';
          }

          if (operation === 'optimize_standard') {
            params.onChunk('A cinematic runner sprints');
            return 'A cinematic runner sprints through a sunlit city street at golden hour.';
          }

          params.onChunk('ok');
          return 'ok';
        }
      ),
      supportsStreaming: vi.fn(() => true),
      getAvailableClients: vi.fn(() => ['mock-ai']),
    };

    const container = await configureServices();
    container.registerValue('aiService', aiServiceMock);

    await initializeServices(container);
    app = createApp(container);
  }, 30_000);

  afterAll(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
    } else {
      process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
    }

    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    if (previousPromptOutputOnly === undefined) {
      delete process.env.PROMPT_OUTPUT_ONLY;
    } else {
      process.env.PROMPT_OUTPUT_ONLY = previousPromptOutputOnly;
    }
  });

  beforeEach(() => {
    failOperation = null;
    vi.clearAllMocks();
    aiServiceMock.supportsStreaming.mockReturnValue(true);
    aiServiceMock.getAvailableClients.mockReturnValue(['mock-ai']);
  });

  it('POST /api/optimize rejects unauthenticated requests', async () => {
    const response = await request(app).post('/api/optimize').send({ prompt: 'runner in city' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('POST /api/optimize validates request payloads', async () => {
    const response = await request(app)
      .post('/api/optimize')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: '' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('POST /api/optimize returns optimized prompt for valid requests', async () => {
    const response = await request(app)
      .post('/api/optimize')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: 'runner in city', mode: 'video', skipCache: true });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.prompt).toBeTypeOf('string');
    expect(response.body.prompt.length).toBeGreaterThan(0);
    expect(response.body.optimizedPrompt).toBe(response.body.prompt);
  });

  it('POST /api/optimize returns 500 when optimization service fails', async () => {
    failOperation = 'optimize_standard';

    const response = await request(app)
      .post('/api/optimize')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: 'runner in city', mode: 'video', skipCache: true });

    expect(response.status).toBe(500);
  });

  it('POST /api/optimize-stream rejects unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/optimize-stream')
      .send({ prompt: 'runner in city', mode: 'video' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('POST /api/optimize-stream validates request payloads', async () => {
    const response = await request(app)
      .post('/api/optimize-stream')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: '', mode: 'video' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('POST /api/optimize-stream rejects image-to-video requests on streaming endpoint', async () => {
    const response = await request(app)
      .post('/api/optimize-stream')
      .set('x-api-key', TEST_API_KEY)
      .send({
        prompt: 'runner in city',
        mode: 'video',
        startImage: 'https://images.example.com/start.jpg',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      'Streaming optimization does not support image-to-video. Use /api/optimize.'
    );
  });

  it('POST /api/optimize-stream emits draft, refined, and done events for valid requests', async () => {
    const response = await request(app)
      .post('/api/optimize-stream')
      .set('x-api-key', TEST_API_KEY)
      .set('Accept', 'text/event-stream')
      .send({ prompt: 'runner in city', mode: 'video', skipCache: true });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = parseSseEvents(response.text);
    const names = events.map((event) => event.event);

    expect(names).toContain('draft');
    expect(names).toContain('refined');
    expect(names).toContain('done');
    expect(names.at(-1)).toBe('done');
  });

  it('POST /api/optimize-compile rejects unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/optimize-compile')
      .send({ prompt: 'runner in city', targetModel: 'kling-v1' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('POST /api/optimize-compile validates request payloads', async () => {
    const response = await request(app)
      .post('/api/optimize-compile')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: 'runner in city' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });

  it('POST /api/optimize-compile returns compiled prompt for valid requests', async () => {
    const response = await request(app)
      .post('/api/optimize-compile')
      .set('x-api-key', TEST_API_KEY)
      .send({ prompt: 'runner in city', targetModel: 'kling-v1' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.compiledPrompt).toBeTypeOf('string');
    expect(response.body.compiledPrompt.length).toBeGreaterThan(0);
  });
});
