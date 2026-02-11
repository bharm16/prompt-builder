import { describe, expect, it } from 'vitest';
import { detectRefusal, validateLLMResponse } from '../ResponseValidator';

describe('ResponseValidator', () => {
  it('flags empty responses as invalid', () => {
    const result = validateLLMResponse('');

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Empty response');
    expect(result.confidence).toBe(0);
  });

  it('detects refusal patterns', () => {
    const text = "I'm sorry, but I can't comply with that request.";
    const result = validateLLMResponse(text);

    expect(detectRefusal(text)).toBe(true);
    expect(result.isRefusal).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it('extracts JSON from preamble and postamble text', () => {
    const result = validateLLMResponse(
      "Sure, here's the JSON: {\"value\": 1} Let me know if you need anything else.",
      { expectJson: true }
    );

    expect(result.isValid).toBe(true);
    expect(result.hasPreamble).toBe(true);
    expect(result.hasPostamble).toBe(true);
    expect(result.cleanedText).toBe('{"value": 1}');
    expect(result.parsed).toEqual({ value: 1 });
  });

  it('extracts JSON from markdown code blocks', () => {
    const result = validateLLMResponse(
      '```json\n{"items":[1,2,3]}\n```',
      { expectJson: true }
    );

    expect(result.isValid).toBe(true);
    expect(result.parsed).toEqual({ items: [1, 2, 3] });
    expect(result.hasPreamble).toBe(true);
    expect(result.hasPostamble).toBe(true);
  });

  it('returns error when expected array payload is missing', () => {
    const result = validateLLMResponse('{"value": 1}', {
      expectJson: true,
      expectArray: true,
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('No array found in response');
  });

  it('validates required nested fields', () => {
    const result = validateLLMResponse('{"parent": {}}', {
      expectJson: true,
      requiredFields: ['parent.child'],
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing required fields: parent.child');
  });

  it('marks oversized responses as potentially truncated', () => {
    const result = validateLLMResponse('x'.repeat(60), {
      maxLength: 10,
    });

    expect(result.warnings.some((w) => w.includes('truncated'))).toBe(true);
    expect(result.isTruncated).toBe(true);
  });
});
