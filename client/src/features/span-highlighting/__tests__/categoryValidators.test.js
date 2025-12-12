/**
 * Structural span validation tests.
 *
 * Semantic regex validation was removed; we now trust the backend AI.
 * These tests cover stable invariants only:
 * - text required
 * - category must be valid taxonomy id (with legacy mappings)
 * - optional sourceText containment check
 */

import { describe, it, expect } from 'vitest';
import { validateSpan, CATEGORY_CAPS, LEGACY_MAPPINGS } from '../utils/categoryValidators.js';
import { TAXONOMY } from '@shared/taxonomy';

describe('categoryValidators (structural)', () => {
  it('passes for a valid span using canonical taxonomy category', () => {
    const span = { category: TAXONOMY.CAMERA.id, text: 'pan left' };
    const result = validateSpan(span);
    expect(result.pass).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.category).toBe(TAXONOMY.CAMERA.id);
  });

  it('maps legacy category ids to taxonomy ids', () => {
    const span = { category: 'camera', text: 'pan left' };
    const result = validateSpan(span);
    expect(result.pass).toBe(true);
    expect(result.category).toBe(LEGACY_MAPPINGS.camera);
  });

  it('fails for missing span or empty text', () => {
    expect(validateSpan(null).pass).toBe(false);
    expect(validateSpan({ category: TAXONOMY.CAMERA.id, text: '' }).reason).toBe('empty_text');
  });

  it('fails for invalid taxonomy id', () => {
    const result = validateSpan({ category: 'not-a-category', text: 'hello' });
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('invalid_taxonomy_id');
  });

  it('fails when sourceText is provided but does not include span text', () => {
    const result = validateSpan({
      category: TAXONOMY.CAMERA.id,
      text: 'hello',
      sourceText: 'goodbye world',
    });
    expect(result.pass).toBe(false);
    expect(result.reason).toBe('text_not_in_source');
  });

  it('defines caps for common taxonomy categories', () => {
    expect(CATEGORY_CAPS[TAXONOMY.CAMERA.id]).toBeGreaterThan(0);
    expect(CATEGORY_CAPS[TAXONOMY.SUBJECT.id]).toBeGreaterThan(0);
  });
});

