import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createOptimizeRoutes } from '@routes/optimize.routes';
import { createEnhancementRoutes } from '@routes/enhancement.routes';

const TEST_API_KEY = 'integration-enhancement-key';

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
      // Keep as raw string when payload is not JSON.
    }

    events.push({ event: eventType, data });
  }

  return events;
}

describe('Enhancement Suggestions Flow (integration)', () => {
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

  it('runs optimize-stream then fetches category-aligned enhancement suggestions', async () => {
    const optimizeSpans = [
      {
        text: 'runner',
        role: 'subject',
        category: 'subject.identity',
        start: 2,
        end: 8,
        confidence: 0.92,
      },
    ];

    const promptOptimizationService = {
      optimize: vi.fn(),
      compilePrompt: vi.fn(),
      optimizeTwoStage: vi.fn(async (requestContext: Record<string, unknown>) => {
        const onDraft = requestContext.onDraft as
          | ((draft: string, spans: { spans: unknown[]; meta: Record<string, unknown> }) => void)
          | undefined;

        onDraft?.('A runner in rain', {
          spans: optimizeSpans,
          meta: { stage: 'draft' },
        });

        return {
          refined: 'A cinematic runner in neon rain',
          refinedSpans: {
            spans: optimizeSpans,
            meta: { stage: 'refined' },
          },
          metadata: { provider: 'test' },
          usedFallback: false,
        };
      }),
    };

    const enhancementService = {
      getEnhancementSuggestions: vi.fn(async (payload: Record<string, unknown>) => {
        const highlightedText = String(payload.highlightedText ?? '');
        const highlightedCategory = String(payload.highlightedCategory ?? 'subject.identity');

        return {
          fromCache: false,
          suggestions: [
            {
              text: `Refine ${highlightedText} with precise detail`,
              explanation: 'Adds specific visual detail while preserving intent.',
              category: highlightedCategory,
              confidence: 0.9,
            },
          ],
        };
      }),
      getCustomSuggestions: vi.fn(),
    };

    const sceneDetectionService = {
      detectSceneChange: vi.fn(),
    };

    const promptCoherenceService = {
      checkCoherence: vi.fn(),
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
    app.use(
      '/api',
      apiAuthMiddleware,
      createEnhancementRoutes({
        enhancementService: enhancementService as never,
        sceneDetectionService: sceneDetectionService as never,
        promptCoherenceService: promptCoherenceService as never,
      })
    );

    const optimizeResponse = await request(app)
      .post('/api/optimize-stream')
      .set('x-api-key', TEST_API_KEY)
      .set('Accept', 'text/event-stream')
      .send({ prompt: 'runner in rain', mode: 'video' });

    expect(optimizeResponse.status).toBe(200);

    const optimizeEvents = parseSseEvents(optimizeResponse.text);
    const spanCandidates = optimizeEvents
      .filter((event) => event.event === 'spans')
      .flatMap((event) => {
        const data = event.data as { spans?: Array<Record<string, unknown>> } | undefined;
        return data?.spans ?? [];
      });

    expect(spanCandidates.length).toBeGreaterThan(0);

    const selectedSpan = spanCandidates[0];
    const highlightedText = String(selectedSpan?.text ?? 'runner');
    const highlightedCategory = String(selectedSpan?.category ?? 'subject.identity');

    const suggestionsResponse = await request(app)
      .post('/api/get-enhancement-suggestions')
      .set('x-api-key', TEST_API_KEY)
      .send({
        highlightedText,
        highlightedPhrase: highlightedText,
        fullPrompt: 'A cinematic runner in neon rain',
        originalUserPrompt: 'runner in rain',
        contextBefore: 'A cinematic ',
        contextAfter: ' in neon rain',
        highlightedCategory,
        highlightedCategoryConfidence: 0.92,
      });

    expect(suggestionsResponse.status).toBe(200);
    expect(Array.isArray(suggestionsResponse.body.suggestions)).toBe(true);
    expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);

    for (const suggestion of suggestionsResponse.body.suggestions as Array<Record<string, unknown>>) {
      expect(typeof suggestion.text).toBe('string');
      expect(suggestion.category).toBe(highlightedCategory);
    }

    expect(enhancementService.getEnhancementSuggestions).toHaveBeenCalledWith(
      expect.objectContaining({
        highlightedText,
        highlightedCategory,
      })
    );
  });

  it('returns 400 for invalid enhancement suggestion payloads', async () => {
    const promptOptimizationService = {
      optimize: vi.fn(),
      compilePrompt: vi.fn(),
      optimizeTwoStage: vi.fn(),
    };

    const enhancementService = {
      getEnhancementSuggestions: vi.fn(),
      getCustomSuggestions: vi.fn(),
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
    app.use(
      '/api',
      apiAuthMiddleware,
      createEnhancementRoutes({
        enhancementService: enhancementService as never,
        sceneDetectionService: { detectSceneChange: vi.fn() } as never,
        promptCoherenceService: { checkCoherence: vi.fn() } as never,
      })
    );

    const response = await request(app)
      .post('/api/get-enhancement-suggestions')
      .set('x-api-key', TEST_API_KEY)
      .send({
        fullPrompt: 'A cinematic runner in neon rain',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation failed');
  });
});
