import { describe, expect, it } from 'vitest';

import { GEMINI_JSON_SCHEMA } from '@server/llm/span-labeling/schemas/GeminiSchema';
import { normalizeOpenAiSchema } from '@server/clients/adapters/openai/normalizeSchema';

describe('GEMINI_JSON_SCHEMA strict compatibility', () => {
  it('remains valid for strict OpenAI json_schema mode', () => {
    const normalized = normalizeOpenAiSchema({
      name: 'span_labeling_response',
      schema: GEMINI_JSON_SCHEMA as Record<string, unknown>,
    }).schema as Record<string, unknown>;

    expect(normalized.additionalProperties).toBe(false);
    expect(normalized.required).toEqual([
      'analysis_trace',
      'spans',
      'meta',
      'isAdversarial',
    ]);

    const properties = normalized.properties as Record<string, unknown>;
    const spanItems = (properties.spans as Record<string, unknown>).items as Record<string, unknown>;
    const meta = properties.meta as Record<string, unknown>;

    expect(spanItems.additionalProperties).toBe(false);
    expect(spanItems.required).toEqual(['text', 'role', 'confidence']);
    expect(meta.additionalProperties).toBe(false);
    expect(meta.required).toEqual(['version', 'notes']);
  });
});
