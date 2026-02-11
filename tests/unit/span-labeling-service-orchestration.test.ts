import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SpanLabelingConfig from '@llm/span-labeling/config/SpanLabelingConfig.js';
import type { LabelSpansResult } from '@llm/span-labeling/types';

const mockDetectInjectionPatterns = vi.hoisted(() => vi.fn());
const mockCreateLlmClient = vi.hoisted(() => vi.fn());
const mockGetCurrentSpanProvider = vi.hoisted(() => vi.fn(() => 'groq'));
const mockExtractSpans = vi.hoisted(() => vi.fn());

vi.mock('@utils/SecurityPrompts', () => ({
  detectInjectionPatterns: (text: string) => mockDetectInjectionPatterns(text),
}));

vi.mock('@llm/span-labeling/services/LlmClientFactory.js', () => ({
  createLlmClient: (params: unknown) => mockCreateLlmClient(params),
  getCurrentSpanProvider: () => mockGetCurrentSpanProvider(),
}));

vi.mock('@llm/span-labeling/strategies/NlpSpanStrategy.js', () => ({
  NlpSpanStrategy: class {
    extractSpans(...args: unknown[]) {
      return mockExtractSpans(...args);
    }
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SpanLabelingService orchestration', () => {
  const originalChunking = {
    MAX_WORDS_PER_CHUNK: SpanLabelingConfig.CHUNKING.MAX_WORDS_PER_CHUNK,
    OVERLAP_WORDS: SpanLabelingConfig.CHUNKING.OVERLAP_WORDS,
    PROCESS_CHUNKS_IN_PARALLEL: SpanLabelingConfig.CHUNKING.PROCESS_CHUNKS_IN_PARALLEL,
    MAX_CONCURRENT_CHUNKS: SpanLabelingConfig.CHUNKING.MAX_CONCURRENT_CHUNKS,
  };

  const createAiService = (overrides?: {
    getOperationConfig?: () => { model?: string };
    execute?: () => Promise<unknown>;
  }) => ({
    getOperationConfig: overrides?.getOperationConfig ?? (() => ({ model: 'gpt-4o-mini' })),
    execute: overrides?.execute ?? (async () => ({})),
  });

  beforeEach(() => {
    mockDetectInjectionPatterns.mockReset();
    mockCreateLlmClient.mockReset();
    mockGetCurrentSpanProvider.mockReset();
    mockExtractSpans.mockReset();

    mockDetectInjectionPatterns.mockReturnValue({ hasPatterns: false, patterns: [] });
    mockGetCurrentSpanProvider.mockReturnValue('groq');
  });

  afterEach(() => {
    (SpanLabelingConfig.CHUNKING as { MAX_WORDS_PER_CHUNK: number }).MAX_WORDS_PER_CHUNK =
      originalChunking.MAX_WORDS_PER_CHUNK;
    (SpanLabelingConfig.CHUNKING as { OVERLAP_WORDS: number }).OVERLAP_WORDS =
      originalChunking.OVERLAP_WORDS;
    (
      SpanLabelingConfig.CHUNKING as { PROCESS_CHUNKS_IN_PARALLEL: boolean }
    ).PROCESS_CHUNKS_IN_PARALLEL = originalChunking.PROCESS_CHUNKS_IN_PARALLEL;
    (SpanLabelingConfig.CHUNKING as { MAX_CONCURRENT_CHUNKS: number }).MAX_CONCURRENT_CHUNKS =
      originalChunking.MAX_CONCURRENT_CHUNKS;
  });

  it('returns NLP result on fast-path hit and skips LLM client', async () => {
    const nlpResult: LabelSpansResult = {
      spans: [{ text: 'camera pan', role: 'camera.movement', start: 2, end: 12, confidence: 0.92 }],
      meta: { version: 'nlp-v1', notes: 'Generated via dictionary' },
    };
    mockExtractSpans.mockResolvedValue(nlpResult);

    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService.js');
    const result = await labelSpans(
      { text: 'A camera pans across the room.' },
      createAiService() as never
    );

    expect(result).toEqual(nlpResult);
    expect(mockCreateLlmClient).not.toHaveBeenCalled();
  });

  it('falls back to LLM when NLP fast-path misses', async () => {
    mockExtractSpans.mockResolvedValue(null);
    const getSpans = vi.fn().mockResolvedValue({
      spans: [{ text: 'red coat', role: 'subject.wardrobe', start: 2, end: 10, confidence: 0.85 }],
      meta: { version: 'v1', notes: 'llm fallback' },
    });
    mockCreateLlmClient.mockReturnValue({ getSpans });

    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService.js');
    const result = await labelSpans(
      { text: 'A red coat hangs in frame.' },
      createAiService() as never
    );

    expect(mockCreateLlmClient).toHaveBeenCalledWith({ operation: 'span_labeling' });
    expect(getSpans).toHaveBeenCalledOnce();
    expect(result.spans).toHaveLength(1);
    expect(result.spans[0]?.role).toBe('subject.wardrobe');
  });

  it('applies i2v category filter on final result', async () => {
    const nlpResult: LabelSpansResult = {
      spans: [
        { text: 'hero', role: 'subject.identity', start: 2, end: 6, confidence: 0.9 },
        { text: 'sprints', role: 'action.movement', start: 7, end: 14, confidence: 0.91 },
        { text: 'rack focus', role: 'camera.focus', start: 20, end: 30, confidence: 0.88 },
      ],
      meta: { version: 'nlp-v1', notes: 'nlp spans' },
    };
    mockExtractSpans.mockResolvedValue(nlpResult);

    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService.js');
    const result = await labelSpans(
      { text: 'A hero sprints, rack focus to background.', templateVersion: 'i2v-v3' },
      createAiService() as never
    );

    expect(result.spans.map((span) => span.role)).toEqual(['action.movement', 'camera.focus']);
    expect(result.meta.notes).toContain('i2v motion filter applied');
  });

  it('processes large text through chunked path and merges chunk results', async () => {
    (SpanLabelingConfig.CHUNKING as { MAX_WORDS_PER_CHUNK: number }).MAX_WORDS_PER_CHUNK = 4;
    (SpanLabelingConfig.CHUNKING as { OVERLAP_WORDS: number }).OVERLAP_WORDS = 0;
    (
      SpanLabelingConfig.CHUNKING as { PROCESS_CHUNKS_IN_PARALLEL: boolean }
    ).PROCESS_CHUNKS_IN_PARALLEL = false;

    mockExtractSpans.mockResolvedValue(null);

    const getSpans = vi.fn().mockImplementation(async ({ text }: { text: string }) => {
      const firstToken = /\b[\p{L}\p{N}'-]+\b/gu.exec(text)?.[0] ?? '';
      const span =
        firstToken.length > 0
          ? [
              {
                text: firstToken,
                role: 'subject.identity',
                start: 0,
                end: firstToken.length,
                confidence: 0.95,
              },
            ]
          : [];
      return {
        spans: span,
        meta: { version: 'v1', notes: 'chunk pass' },
      };
    });
    mockCreateLlmClient.mockReturnValue({ getSpans });

    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService.js');
    const text = 'alpha beta gamma. delta epsilon zeta. eta theta iota.';

    const result = await labelSpans(
      { text, minConfidence: 0.4, maxSpans: 20 },
      createAiService() as never
    );

    expect(getSpans.mock.calls.length).toBeGreaterThan(1);
    expect(result.spans.length).toBeGreaterThan(1);
    for (const span of result.spans) {
      expect(typeof span.start).toBe('number');
      expect(typeof span.end).toBe('number');
      if (typeof span.start === 'number' && typeof span.end === 'number') {
        expect(text.slice(span.start, span.end)).toBe(span.text);
      }
    }
    expect(result.meta.notes).toContain('Processed');
  });

  it('normalizes streamed spans in real labelSpansStream path and drops unresolvable spans', async () => {
    const streamSpans = vi.fn().mockImplementation(async function* (params: Record<string, unknown>) {
      yield { text: 'Alpha', role: 'subject.identity', confidence: 0.8, start: 0, end: 5 };
      yield { text: 'BETA', category: 'action.movement', confidence: 0.7 };
      yield { text: 'missing token', role: 'action.gesture', confidence: 0.6 };
    });

    mockCreateLlmClient.mockReturnValue({ streamSpans });

    const { labelSpansStream } = await import('@llm/span-labeling/SpanLabelingService.js');
    const aiService = createAiService({
      getOperationConfig: () => ({ model: 'gpt-4o-mini' }),
    });

    const output: Array<{ text: string; role: string; start: number; end: number }> = [];
    for await (const span of labelSpansStream(
      { text: 'Alpha beta gamma', maxSpans: 7, minConfidence: 0.4 },
      aiService as never
    )) {
      output.push(span as { text: string; role: string; start: number; end: number });
    }

    expect(mockCreateLlmClient).toHaveBeenCalledWith({
      operation: 'span_labeling',
      model: 'gpt-4o-mini',
    });
    expect(streamSpans).toHaveBeenCalledOnce();
    const streamParams = streamSpans.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(streamParams).toMatchObject({
      text: 'Alpha beta gamma',
      nlpSpansAttempted: 0,
    });
    if (!streamParams) {
      throw new Error('Expected streamed params to be captured');
    }
    expect(streamParams.policy as Record<string, unknown>).toMatchObject({ allowOverlap: false });
    expect(streamParams.options as Record<string, unknown>).toMatchObject({
      maxSpans: 7,
      minConfidence: 0.4,
    });
    expect(streamParams.cache).toBeTruthy();

    expect(output).toHaveLength(2);
    expect(output[0]).toMatchObject({ text: 'Alpha', role: 'subject.identity', start: 0, end: 5 });
    expect(output[1]).toMatchObject({ text: 'beta', role: 'action.movement', start: 6, end: 10 });
    expect('missing token'.includes(output.map((span) => span.text).join(' '))).toBe(false);
  });

  it('handles getOperationConfig errors and still streams spans', async () => {
    const streamSpans = vi.fn().mockImplementation(async function* () {
      yield { text: 'runs', role: 'action.movement', confidence: 0.9, start: 4, end: 8 };
    });
    mockCreateLlmClient.mockReturnValue({ streamSpans });

    const { labelSpansStream } = await import('@llm/span-labeling/SpanLabelingService.js');
    const aiService = createAiService({
      getOperationConfig: () => {
        throw new Error('config unavailable');
      },
    });

    const output: Array<{ text: string; role: string; start: number; end: number }> = [];
    for await (const span of labelSpansStream({ text: 'cat runs fast' }, aiService as never)) {
      output.push(span as { text: string; role: string; start: number; end: number });
    }

    expect(mockCreateLlmClient).toHaveBeenCalledWith({ operation: 'span_labeling' });
    expect(output).toEqual([
      { text: 'runs', role: 'action.movement', confidence: 0.9, start: 4, end: 8 },
    ]);
  });
});
