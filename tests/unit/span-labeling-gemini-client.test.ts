import { describe, expect, it } from 'vitest';

import { GeminiLlmClient } from '@llm/span-labeling/services/GeminiLlmClient';
import { SubstringPositionCache } from '@llm/span-labeling/cache/SubstringPositionCache';

class TestGeminiClient extends GeminiLlmClient {
  public parse(text: string) {
    return this._parseResponseText(text);
  }

  public normalize(value: Record<string, unknown>) {
    return this._normalizeParsedResponse(value);
  }
}

describe('GeminiLlmClient', () => {
  it('recovers spans from non-JSON response text', () => {
    const client = new TestGeminiClient();
    const result = client.parse(
      '{"text":"cat","role":"subject.identity"}\n' +
        '{"text":"dog","role":"subject.identity"}'
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const value = result.value as { spans?: Array<Record<string, unknown>> };
      expect(value.spans).toHaveLength(2);
      expect(value.spans?.[0]?.text).toBe('cat');
    }
  });

  it('returns parse errors when recovery fails', () => {
    const client = new TestGeminiClient();
    const result = client.parse('not json at all');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid JSON');
    }
  });

  it('normalizes category fields into role values', () => {
    const client = new TestGeminiClient();
    const normalized = client.normalize({
      spans: [{ text: 'cat', category: 'subject.identity' }],
    });

    const spans = normalized.spans as Array<Record<string, unknown>>;
    const firstSpan = spans[0];
    expect(firstSpan?.role).toBe('subject.identity');
    expect(firstSpan ? 'category' in firstSpan : false).toBe(false);
  });

  it('streams NDJSON spans and ignores invalid lines', async () => {
    const client = new GeminiLlmClient();

    const aiService = {
      stream: async (_op: string, { onChunk }: { onChunk: (chunk: string) => void }) => {
        onChunk('{"text":"cat","role":"subject.identity"}\n');
        onChunk('{ bad json }\n');
        onChunk('{"text":"dog","category":"subject.identity"}\n');
      },
    };

    const spans: Array<Record<string, unknown>> = [];

    for await (const span of client.streamSpans({
      text: 'A cat and dog',
      policy: { allowOverlap: false },
      options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
      enableRepair: false,
      aiService: aiService as never,
      cache: new SubstringPositionCache(),
    })) {
      spans.push(span as Record<string, unknown>);
    }

    expect(spans).toHaveLength(2);
    expect(spans[0]?.category).toBe('subject.identity');
    expect(spans[1]?.category).toBe('subject.identity');
  });
});
