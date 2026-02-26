import { describe, expect, it } from 'vitest';
import { transformOpenApiProperties } from '@scripts/lib/transform';

describe('transformOpenApiProperties regression', () => {
  it('skips cfg_scale guidance mapping when max <= 1', () => {
    const result = transformOpenApiProperties({
      prompt: { type: 'string' },
      cfg_scale: { type: 'number', minimum: 0, maximum: 1, default: 0.5 },
    });

    expect(result.fields.guidance).toBeUndefined();
    expect(result.unknownFields).toContain('cfg_scale');
  });

  it('maps guidance_scale when numeric metadata is integer-safe', () => {
    const result = transformOpenApiProperties({
      prompt: { type: 'string' },
      guidance_scale: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        multipleOf: 1,
        default: 7,
      },
    });

    expect(result.fields.guidance).toBeDefined();
    expect(result.fields.guidance?.type).toBe('int');
    expect(result.fields.guidance?.ui?.label).toBe('Guidance');
    expect(result.fields.guidance?.constraints?.max).toBe(20);
    expect(result.unknownFields).not.toContain('guidance_scale');
  });

  it('does not coerce non-integer-safe guidance values into int fields', () => {
    const result = transformOpenApiProperties({
      prompt: { type: 'string' },
      guidance_scale: {
        type: 'number',
        minimum: 0,
        maximum: 10,
        multipleOf: 0.5,
        default: 0.5,
      },
    });

    expect(result.fields.guidance).toBeUndefined();
    expect(result.unknownFields).toContain('guidance_scale');
  });
});
