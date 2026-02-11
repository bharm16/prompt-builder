import { describe, it, expect } from 'vitest';
import { parseLabelSpansRequest } from '../requestParser';

describe('parseLabelSpansRequest', () => {
  it('parses numeric strings and strips unknown fields', () => {
    const result = parseLabelSpansRequest({
      text: 'A cinematic scene',
      maxSpans: '12',
      minConfidence: '0.75',
      unknownField: 'ignored',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.maxSpans).toBe(12);
    expect(result.data.minConfidence).toBe(0.75);
    expect(result.data.payload).toEqual({
      text: 'A cinematic scene',
      maxSpans: 12,
      minConfidence: 0.75,
    });
    expect('unknownField' in result.data.payload).toBe(false);
  });

  it('maps isI2VMode to i2v templateVersion when missing', () => {
    const result = parseLabelSpansRequest({
      text: 'Camera pans left as she smiles.',
      isI2VMode: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.templateVersion).toBe('i2v-v1');
  });

  it('maps isI2VMode string true to i2v templateVersion', () => {
    const result = parseLabelSpansRequest({
      text: 'Camera pans left as she smiles.',
      isI2VMode: 'true',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.templateVersion).toBe('i2v-v1');
    expect(result.data.isI2VMode).toBe(true);
  });

  it('does not override an explicit templateVersion even when i2v mode is true', () => {
    const result = parseLabelSpansRequest({
      text: 'Camera pans left as she smiles.',
      isI2VMode: true,
      templateVersion: 'custom-v2',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.templateVersion).toBe('custom-v2');
  });

  it('returns 400 when text is missing or empty', () => {
    const missing = parseLabelSpansRequest({});
    const empty = parseLabelSpansRequest({ text: '' });

    expect(missing).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid input: expected string, received undefined',
    });
    expect(empty).toEqual({
      ok: false,
      status: 400,
      error: 'text is required',
    });
  });

  it('returns 400 for maxSpans outside allowed range', () => {
    const tooLarge = parseLabelSpansRequest({
      text: 'Scene text',
      maxSpans: 81,
    });
    const invalid = parseLabelSpansRequest({
      text: 'Scene text',
      maxSpans: 'abc',
    });

    expect(tooLarge).toEqual({
      ok: false,
      status: 400,
      error: 'Too big: expected number to be <=80',
    });
    expect(invalid).toEqual({
      ok: false,
      status: 400,
      error: 'Invalid input: expected number, received undefined',
    });
  });

  it('returns 400 for minConfidence outside [0, 1]', () => {
    const tooHigh = parseLabelSpansRequest({
      text: 'Scene text',
      minConfidence: 1.1,
    });
    const tooLow = parseLabelSpansRequest({
      text: 'Scene text',
      minConfidence: -0.01,
    });

    expect(tooHigh).toEqual({
      ok: false,
      status: 400,
      error: 'Too big: expected number to be <=1',
    });
    expect(tooLow).toEqual({
      ok: false,
      status: 400,
      error: 'Too small: expected number to be >=0',
    });
  });

  it('passes policy through to payload as validation policy', () => {
    const result = parseLabelSpansRequest({
      text: 'A cinematic scene',
      policy: {
        allowOverlap: false,
        confidenceThreshold: 0.6,
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.payload.policy).toEqual({
      allowOverlap: false,
      confidenceThreshold: 0.6,
    });
  });
});
