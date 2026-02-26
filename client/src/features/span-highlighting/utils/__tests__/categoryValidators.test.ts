import { describe, expect, it } from 'vitest';
import { TAXONOMY } from '@shared/taxonomy';
import { LEGACY_MAPPINGS, validateSpan } from '../categoryValidators';

describe('categoryValidators', () => {
  it('returns missing_span when span is nullish', () => {
    expect(validateSpan(null)).toEqual({ span: null, pass: false, reason: 'missing_span' });
    expect(validateSpan(undefined)).toEqual({ span: null, pass: false, reason: 'missing_span' });
  });

  it('returns empty_text when text/quote is blank', () => {
    expect(validateSpan({ category: TAXONOMY.SUBJECT.id, text: '   ' })).toEqual(
      expect.objectContaining({
        pass: false,
        reason: 'empty_text',
      })
    );
  });

  it('maps legacy category ids before validation', () => {
    expect(LEGACY_MAPPINGS.cameraMove).toBe(TAXONOMY.CAMERA.attributes.MOVEMENT);

    const result = validateSpan({
      text: 'slow pan',
      category: 'cameraMove',
      sourceText: 'A slow pan across the skyline',
    });

    expect(result).toEqual({
      span: {
        text: 'slow pan',
        category: 'cameraMove',
        sourceText: 'A slow pan across the skyline',
      },
      pass: true,
      category: TAXONOMY.CAMERA.attributes.MOVEMENT,
      reason: null,
    });
  });

  it('rejects invalid taxonomy categories', () => {
    const result = validateSpan({
      text: 'unknown category text',
      category: 'not-valid-category',
    });

    expect(result).toEqual({
      span: {
        text: 'unknown category text',
        category: 'not-valid-category',
      },
      pass: false,
      reason: 'invalid_taxonomy_id',
      category: 'not-valid-category',
    });
  });

  it('rejects span text that does not exist in provided source text', () => {
    const result = validateSpan({
      text: 'rainy street',
      category: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
      sourceText: 'A bright sunny beach scene',
    });

    expect(result).toEqual({
      span: {
        text: 'rainy street',
        category: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
        sourceText: 'A bright sunny beach scene',
      },
      pass: false,
      reason: 'text_not_in_source',
      category: TAXONOMY.ENVIRONMENT.attributes.LOCATION,
    });
  });

  it('passes structural validation for valid taxonomy ids and matching source text', () => {
    const span = {
      quote: 'golden hour',
      role: TAXONOMY.LIGHTING.attributes.TIME,
      sourceText: 'Captured at golden hour with warm glow',
    };

    expect(validateSpan(span)).toEqual({
      span,
      pass: true,
      category: TAXONOMY.LIGHTING.attributes.TIME,
      reason: null,
    });
  });
});
