/**
 * Tests for categoryValidators
 *
 * Test Plan:
 * - Verifies camera validator detects motion terms, lens specs, and verb+noun patterns
 * - Verifies lighting validator detects source+modifier combinations
 * - Verifies technical validator detects units and numeric values
 * - Verifies style validator detects adjective+noun patterns
 * - Verifies environment validator detects location nouns
 * - Verifies validateSpan handles category re-typing
 * - Verifies edge cases (empty text, null input, invalid categories)
 *
 * What these tests catch:
 * - Breaking regex patterns for category detection
 * - Failing to handle empty or null input
 * - Incorrect validation logic allowing invalid spans
 * - Breaking category re-typing functionality
 */

import { describe, it, expect } from 'vitest';
import { validateSpan, CATEGORY_CAPS } from '../categoryValidators.js';

describe('categoryValidators', () => {
  describe('camera validator', () => {
    it('passes for camera motion terms - catches motion detection bug', () => {
      // Would fail if CAMERA_MOTION_TERMS regex is broken
      const span = { category: 'camera', text: 'dolly shot forward' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for lens spec with camera device - catches lens detection', () => {
      // Would fail if LENS_SPEC or CAMERA_DEVICE_TERMS regex is broken
      const span = { category: 'camera', text: '35mm lens wide angle' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for verb and noun pattern - catches NLP pattern bug', () => {
      // Would fail if hasVerbAndNoun is broken
      const span = { category: 'camera', text: 'pan the camera' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('fails for non-camera text - catches false positive bug', () => {
      // Would fail if validator is too permissive
      const span = { category: 'camera', text: 'beautiful sunset' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('camera_missing_motion_or_lens_action');
    });

    it('fails for empty text - catches empty input handling', () => {
      // Would fail if empty text isn't rejected
      const span = { category: 'camera', text: '' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('empty_text');
    });
  });

  describe('lighting validator', () => {
    it('passes for source and modifier - catches combined detection', () => {
      // Would fail if either regex is broken
      const span = { category: 'lighting', text: 'warm key light' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for modifier with light effect words - catches effect detection', () => {
      // Would fail if glow/wash/beam/flare detection is broken
      const span = { category: 'lighting', text: 'soft glow' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for source with "lighting" word - catches word detection', () => {
      // Would fail if /light(?:ing)?/ regex is broken
      const span = { category: 'lighting', text: 'key lighting' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for modifier with "lighting" word - catches modifier+word combo', () => {
      // Would fail if modifier detection with "light" is broken
      const span = { category: 'lighting', text: 'dramatic lighting' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('fails for non-lighting text - catches false positive', () => {
      // Would fail if validator is too permissive
      const span = { category: 'lighting', text: 'camera movement' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('lighting_missing_source_or_modifier');
    });
  });

  describe('technical validator', () => {
    it('passes for number with unit - catches unit detection', () => {
      // Would fail if TECH_NUMBER_UNIT regex is broken
      const span = { category: 'technical', text: '24fps' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for number with spaced unit - catches spaced format', () => {
      // Would fail if spacing in regex is broken
      const span = { category: 'technical', text: '35 mm' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for metadata unitMatch flag - catches metadata handling', () => {
      // Would fail if metadata check is removed
      const span = { category: 'technical', text: 'something', metadata: { unitMatch: true } };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for unit with number in text - catches pattern detection', () => {
      // Would fail if TECH_UNIT detection with \d is broken
      const span = { category: 'technical', text: 'shot at f/2.8' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('fails for text without units or numbers - catches validation', () => {
      // Would fail if validator doesn't require technical specs
      const span = { category: 'technical', text: 'beautiful shot' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('technical_missing_unit_or_value');
    });
  });

  describe('style validator', () => {
    it('passes for style adjective and noun - catches style pattern', () => {
      // Would fail if STYLE_ADJ or STYLE_NOUN regex is broken
      const span = { category: 'style', text: 'noir aesthetic' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for specific adjective with noun - catches adjective filtering', () => {
      // Would fail if extractAdjectives or GENERIC_ADJECTIVES is broken
      const span = { category: 'style', text: 'moody atmosphere' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('fails for generic adjective only - catches generic filtering', () => {
      // Would fail if GENERIC_ADJECTIVES check is removed
      const span = { category: 'style', text: 'beautiful shot' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('style_missing_adj_noun');
    });

    it('fails for text without adjective-noun pattern - catches pattern requirement', () => {
      // Would fail if hasAdjAndNoun is too permissive
      const span = { category: 'style', text: 'camera movement' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
    });
  });

  describe('environment validator', () => {
    it('passes for environment nouns - catches location detection', () => {
      // Would fail if ENVIRONMENT_NOUN regex is broken
      const span = { category: 'environment', text: 'forest clearing' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes for multiple location types - catches comprehensive noun list', () => {
      // Tests various environment terms
      const locations = ['street', 'warehouse', 'desert', 'cathedral', 'bridge'];
      locations.forEach(loc => {
        const span = { category: 'environment', text: loc };
        const result = validateSpan(span);
        expect(result.pass).toBe(true);
      });
    });

    it('fails for non-environment text - catches false positive', () => {
      // Would fail if validator is too permissive
      const span = { category: 'environment', text: 'warm lighting' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('environment_missing_place_noun');
    });
  });

  describe('always-pass validators', () => {
    it('passes subject category without validation - catches bypass logic', () => {
      // Would fail if subject validator is changed to validate
      const span = { category: 'subject', text: 'anything' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes action category without validation - catches bypass logic', () => {
      // Would fail if action validator is changed to validate
      const span = { category: 'action', text: 'anything' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('passes mood category without validation - catches bypass logic', () => {
      // Would fail if mood validator is changed to validate
      const span = { category: 'mood', text: 'anything' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });
  });

  describe('validateSpan function', () => {
    it('returns failure for missing span - catches null handling', () => {
      // Would fail if null check is removed
      const result = validateSpan(null);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('missing_span');
    });

    it('returns failure for undefined span - catches undefined handling', () => {
      // Would fail if undefined check is removed
      const result = validateSpan(undefined);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('missing_span');
    });

    it('attempts re-typing when category validator not found - catches re-typing', () => {
      // Would fail if re-typing loop is broken
      const span = { category: 'unknown', text: 'dolly shot' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
      expect(result.category).toBe('camera');
      expect(result.reason).toBe('retyped_category');
    });

    it('attempts re-typing when validator fails - catches fallback', () => {
      // Would fail if re-typing only happens for missing validators
      const span = { category: 'lighting', text: 'forest' };
      const result = validateSpan(span);
      // Should retype to environment
      expect(result.category).toBe('environment');
      expect(result.reason).toBe('retyped_category');
    });

    it('returns original category when re-typing fails - catches final fallback', () => {
      // Would fail if we don't return failure when all validators fail
      const span = { category: 'unknown', text: 'nonsense text xyz' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('no_matching_validator');
    });

    it('preserves span in result - catches span passthrough', () => {
      // Would fail if span is not included in result
      const span = { category: 'camera', text: 'dolly shot', id: '123' };
      const result = validateSpan(span);
      expect(result.span).toBe(span);
      expect(result.span.id).toBe('123');
    });
  });

  describe('CATEGORY_CAPS export', () => {
    it('exports category caps object - catches export bug', () => {
      // Would fail if CATEGORY_CAPS is not exported
      expect(CATEGORY_CAPS).toBeDefined();
      expect(typeof CATEGORY_CAPS).toBe('object');
    });

    it('contains cap values for categories - catches missing caps', () => {
      // Would fail if caps are removed
      expect(CATEGORY_CAPS.camera).toBe(2);
      expect(CATEGORY_CAPS.lighting).toBe(2);
      expect(CATEGORY_CAPS.technical).toBe(3);
      expect(CATEGORY_CAPS.subject).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('handles span with quote instead of text - catches alternative text source', () => {
      // Tests ensureText helper with quote field
      const span = { category: 'camera', quote: 'dolly shot' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('handles span with both text and quote - catches text priority', () => {
      // Tests ensureText priority: text over quote
      const span = { category: 'camera', text: 'dolly shot', quote: 'other' };
      const result = validateSpan(span);
      expect(result.pass).toBe(true);
    });

    it('handles whitespace-only text - catches trimming', () => {
      // Would fail if trim() is not called in ensureText
      const span = { category: 'camera', text: '   ' };
      const result = validateSpan(span);
      expect(result.pass).toBe(false);
      expect(result.reason).toBe('empty_text');
    });
  });
});
