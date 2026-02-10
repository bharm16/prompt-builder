import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createOptimizeRoutes } from '@routes/optimize.routes';
import { VALID_CATEGORIES } from '#shared/taxonomy';

const TEST_API_KEY = 'integration-optimize-key';

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

function parseSseEvents(ssePayload: string): ParsedSseEvent[] {
  const chunks = ssePayload
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);

  const events: ParsedSseEvent[] = [];

  for (const chunk of chunks) {
    const lines = chunk.split('\n').map((line) => line.trim());
    let eventType = 'message';
    const dataLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith(':')) {
        continue;
      }
      if (line.startsWith('event:')) {
        eventType = line.slice('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        dataLines.push(line.slice('data:'.length).trim());
      }
    }

    if (dataLines.length === 0) {
      continue;
    }

    const rawData = dataLines.join('\n');
    let data: unknown = rawData;
    try {
      data = JSON.parse(rawData) as unknown;
    } catch {
      // Leave as raw string when payload is not JSON.
    }

    events.push({ event: eventType, data });
  }

  return events;
}

describe('Optimization Flow (integration)', () => {
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

  it('POST /api/optimize-stream emits draft, spans, refined, and done SSE events', async () => {
    const promptOptimizationService = {
      optimize: vi.fn(),
      compilePrompt: vi.fn(),
      optimizeTwoStage: vi.fn(async (requestContext: Record<string, unknown>) => {
        const onDraftChunk = requestContext.onDraftChunk as ((delta: string) => void) | undefined;
        const onDraft = requestContext.onDraft as
          | ((draft: string, spans: { spans: unknown[]; meta: Record<string, unknown> }) => void)
          | undefined;
        const onRefinedChunk = requestContext.onRefinedChunk as ((delta: string) => void) | undefined;

        onDraftChunk?.('A cinematic');
        onDraft?.('A cinematic draft prompt', {
          spans: [
            {
              text: 'runner',
              role: 'subject',
              category: 'subject.identity',
              start: 2,
              end: 8,
              confidence: 0.9,
            },
          ],
          meta: { source: 'integration-draft' },
        });
        onRefinedChunk?.(' with atmosphere');

        return {
          refined: 'A cinematic runner with atmosphere',
          refinedSpans: {
            spans: [
              {
                text: 'golden hour',
                role: 'lighting',
                category: 'lighting.timeOfDay',
                start: 30,
                end: 41,
                confidence: 0.88,
              },
            ],
            meta: { source: 'integration-refined' },
          },
          metadata: { provider: 'test' },
          usedFallback: false,
        };
      }),
    };

    const app = express();
    app.use(express.json());
    app.use(
      '/api',
      apiAuthMiddleware,
      createOptimizeRoutes({
        promptOptimizationService: promptOptimizationService as never,
      })
    );

    const response = await request(app)
      .post('/api/optimize-stream')
      .set('x-api-key', TEST_API_KEY)
      .set('Accept', 'text/event-stream')
      .send({ prompt: 'person walking on beach', mode: 'video' });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    const events = parseSseEvents(response.text);
    const eventNames = events.map((event) => event.event);

    expect(eventNames).toContain('draft');
    expect(eventNames).toContain('spans');
    expect(eventNames).toContain('refined');
    expect(eventNames).toContain('done');

    const refinedEvent = events.find((event) => event.event === 'refined');
    expect((refinedEvent?.data as { refined?: string } | undefined)?.refined).toBe(
      'A cinematic runner with atmosphere'
    );

    const spans = events
      .filter((event) => event.event === 'spans')
      .flatMap((event) => {
        const data = event.data as { spans?: Array<{ category?: string }> } | undefined;
        return data?.spans ?? [];
      });

    expect(spans.length).toBeGreaterThan(0);

    for (const span of spans) {
      if (!span.category) {
        continue;
      }
      expect(VALID_CATEGORIES.has(span.category)).toBe(true);
    }
  });
});
