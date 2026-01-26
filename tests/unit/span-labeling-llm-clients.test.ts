import { describe, expect, it } from 'vitest';

import { GroqLlmClient } from '@llm/span-labeling/services/GroqLlmClient';
import { OpenAILlmClient } from '@llm/span-labeling/services/OpenAILlmClient';

import type { LabelSpansResult } from '@llm/span-labeling/types';

describe('GroqLlmClient', () => {
  it('adjusts confidence using logprobs metadata', () => {
    const client = new GroqLlmClient() as GroqLlmClient & { _lastResponseMetadata: { averageConfidence?: number } };
    client._lastResponseMetadata = { averageConfidence: 0.4 };

    const result: LabelSpansResult = {
      spans: [{ text: 'cat', confidence: 0.9 }],
      meta: { version: 'v1', notes: '' },
    };

    const adjusted = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
      ._postProcessResult(result);

    expect(adjusted.spans[0]?.confidence).toBe(0.4);
    const span = adjusted.spans[0] as { _originalConfidence?: number };
    expect(span._originalConfidence).toBe(0.9);
    expect(adjusted.meta?._providerOptimizations?.logprobsAdjustment).toBe(true);
  });

  it('adds provider metadata even when no logprobs are available', () => {
    const client = new GroqLlmClient() as GroqLlmClient & { _lastResponseMetadata: { averageConfidence?: number } };
    client._lastResponseMetadata = {};

    const result: LabelSpansResult = {
      spans: [{ text: 'cat', confidence: 0.9 }],
      meta: { version: 'v1', notes: '' },
    };

    const adjusted = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
      ._postProcessResult(result);

    expect(adjusted.spans[0]?.confidence).toBe(0.9);
    expect(adjusted.meta?._providerOptimizations?.provider).toBe('groq');
    expect(adjusted.meta?._providerOptimizations?.logprobsAdjustment).toBe(false);
  });
});

describe('OpenAILlmClient', () => {
  it('adds OpenAI provider metadata without changing spans', () => {
    const client = new OpenAILlmClient();
    const result: LabelSpansResult = {
      spans: [{ text: 'cat', confidence: 0.8 }],
      meta: { version: 'v1', notes: '' },
    };

    const adjusted = (client as unknown as { _postProcessResult: (r: LabelSpansResult) => LabelSpansResult })
      ._postProcessResult(result);

    expect(adjusted.spans[0]?.confidence).toBe(0.8);
    expect(adjusted.meta?._providerOptimizations?.provider).toBe('openai');
    expect(adjusted.meta?._providerOptimizations?.strictSchema).toBe(true);
  });
});
