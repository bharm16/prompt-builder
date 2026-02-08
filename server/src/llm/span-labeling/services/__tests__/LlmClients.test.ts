import { describe, it, expect, vi } from 'vitest';
import { GroqLlmClient } from '../GroqLlmClient';
import { OpenAILlmClient } from '../OpenAILlmClient';
import { GeminiLlmClient } from '../GeminiLlmClient';
import type { LabelSpansResult } from '../../types';
import type { SubstringPositionCache } from '../../cache/SubstringPositionCache';

const baseResult: LabelSpansResult = {
  spans: [
    { text: 'cat', role: 'subject', confidence: 0.9 },
    { text: 'runs', role: 'action', confidence: 0.2 },
  ],
  meta: { version: 'v1', notes: '' },
};

describe('LLM Clients', () => {
  describe('error handling', () => {
    it('GroqLlmClient skips logprobs adjustment when metadata missing', () => {
      const client = new GroqLlmClient();
      (client as unknown as { _lastResponseMetadata: Record<string, unknown> })._lastResponseMetadata = {};

      const result = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
        ._postProcessResult(baseResult);

      const providerOptimizations = (result.meta._providerOptimizations ?? {}) as Record<string, unknown>;
      expect(providerOptimizations.logprobsAdjustment).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('GeminiLlmClient normalizes category to role and strips category', () => {
      const client = new GeminiLlmClient();
      const normalized = (client as unknown as { _normalizeParsedResponse: (value: Record<string, unknown>) => Record<string, unknown> })
        ._normalizeParsedResponse({
          spans: [{ text: 'cat', category: 'subject' }],
        });

      const span = (normalized.spans as Array<Record<string, unknown>>)[0];
      expect(span).toBeDefined();
      expect(span?.role).toBe('subject');
      expect(span ? 'category' in span : false).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('GroqLlmClient caps confidence using logprobs average', () => {
      const client = new GroqLlmClient();
      (client as unknown as { _lastResponseMetadata: Record<string, unknown> })._lastResponseMetadata = {
        averageConfidence: 0.4,
        optimizations: ['logprobs'],
      };

      const result = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
        ._postProcessResult(baseResult);

      expect(result.spans[0]?.confidence).toBe(0.4);
      const adjustedSpan = result.spans[0] as unknown as Record<string, unknown> | undefined;
      expect(adjustedSpan?._originalConfidence).toBe(0.9);
      const providerOptimizations = (result.meta._providerOptimizations ?? {}) as Record<string, unknown>;
      expect(providerOptimizations.averageLogprobsConfidence).toBe(0.4);
      expect(result.meta._clientType).toBe('GroqLlmClient');
    });

    it('OpenAILlmClient tags provider metadata without adjustment', () => {
      const client = new OpenAILlmClient();
      const result = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
        ._postProcessResult(baseResult);

      const providerOptimizations = (result.meta._providerOptimizations ?? {}) as Record<string, unknown>;
      expect(providerOptimizations.strictSchema).toBe(true);
      expect(providerOptimizations.logprobsAdjustment).toBe(false);
      expect(result.meta._clientType).toBe('OpenAILlmClient');
    });

    it('GeminiLlmClient streams NDJSON spans and adds category from role', async () => {
      const client = new GeminiLlmClient();
      const aiService = {
        stream: vi.fn(async (_operation: string, params: { onChunk: (chunk: string) => void }) => {
          params.onChunk('[\n');
          params.onChunk('{"text":"cat","role":"subject"},\n');
          params.onChunk('{"text":"runs","role":"action"}\n');
          params.onChunk(']\n');
        }),
      };

      const spans: Array<Record<string, unknown>> = [];
      const params = {
        text: 'Prompt text',
        policy: {},
        options: {},
        enableRepair: false,
        aiService: aiService as unknown as any,
        cache: {} as SubstringPositionCache,
      };

      for await (const span of client.streamSpans(params)) {
        spans.push(span as Record<string, unknown>);
      }

      expect(spans).toHaveLength(2);
      expect(spans[0]?.category).toBe('subject');
      expect(spans[1]?.role).toBe('action');
    });

    it('GeminiLlmClient recovers spans from non-JSON text', () => {
      const client = new GeminiLlmClient();
      const raw = 'Here are spans:\n{"text":"cat","role":"subject"}\n{"text":"runs","role":"action"}';
      const parsed = (client as unknown as { _parseResponseText: (text: string) => { ok: boolean; value?: unknown } })
        ._parseResponseText(raw);

      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        const value = parsed.value as { spans?: Array<Record<string, unknown>> };
        expect(value.spans).toHaveLength(2);
        expect(value.spans?.[0]?.text).toBe('cat');
      }
    });
  });
});
