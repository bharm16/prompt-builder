import { describe, expect, it } from 'vitest';
import { buildResponseFormat } from '../ResponseFormatBuilder';

const config = {
  client: 'openai',
  model: 'gpt-4o',
  temperature: 0,
  maxTokens: 1000,
  timeout: 30000,
};

describe('buildResponseFormat', () => {
  it('prioritizes schema into json_schema response format', () => {
    const result = buildResponseFormat(
      {
        systemPrompt: 'prompt',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      },
      config,
      { strictJsonSchema: true } as never
    );

    expect(result.responseFormat?.type).toBe('json_schema');
    expect(result.jsonMode).toBe(false);
  });

  it('uses explicit responseFormat when provided', () => {
    const result = buildResponseFormat(
      {
        systemPrompt: 'prompt',
        responseFormat: { type: 'json_object' },
      },
      config,
      { strictJsonSchema: false } as never
    );

    expect(result.responseFormat).toEqual({ type: 'json_object' });
    expect(result.jsonMode).toBe(false);
  });

  it('uses config json_object mode when no explicit format is passed', () => {
    const result = buildResponseFormat(
      { systemPrompt: 'prompt' },
      { ...config, responseFormat: 'json_object' },
      { strictJsonSchema: false } as never
    );

    expect(result.responseFormat).toEqual({ type: 'json_object' });
    expect(result.jsonMode).toBe(true);
  });

  it('falls back to params.jsonMode when no response format is configured', () => {
    const result = buildResponseFormat(
      { systemPrompt: 'prompt', jsonMode: true },
      config,
      { strictJsonSchema: false } as never
    );

    expect(result.responseFormat).toBeUndefined();
    expect(result.jsonMode).toBe(true);
  });
});
