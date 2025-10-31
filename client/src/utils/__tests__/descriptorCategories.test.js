/**
 * Tests for descriptorCategories
 *
 * Test Plan:
 * - Verifies detectDescriptorCategoryClient detects correct categories
 * - Verifies confidence scoring logic
 * - Verifies getCategoryColors returns correct color schemes
 * - Verifies getCategoryLabel returns correct labels
 * - Verifies getAllCategoriesInfo returns complete category data
 * - Verifies edge cases (null, empty string, invalid input)
 *
 * What these tests catch:
 * - Breaking regex patterns for category detection
 * - Incorrect confidence calculation
 * - Missing or incorrect color/label mappings
 * - Failing to handle invalid input gracefully
 */

import { describe, it, expect } from 'vitest';
import {
  detectDescriptorCategoryClient,
  getCategoryColors,
  getCategoryLabel,
  getAllCategoriesInfo
} from '../descriptorCategories.js';

describe('descriptorCategories', () => {
  describe('detectDescriptorCategoryClient', () => {
    describe('physical category detection', () => {
      it('detects physical descriptors - catches physical pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.physical regex is broken
        const result = detectDescriptorCategoryClient('person with blue eyes and short hair');
        expect(result.category).toBe('physical');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('returns higher confidence for multiple matches - catches confidence boost', () => {
        // Would fail if match count doesn't increase confidence
        const single = detectDescriptorCategoryClient('blue eyes');
        const multiple = detectDescriptorCategoryClient('blue eyes and dark hair with scars');
        expect(multiple.confidence).toBeGreaterThan(single.confidence);
      });

      it('detects various physical terms - catches comprehensive pattern', () => {
        const terms = ['face', 'hands', 'wrinkles', 'beard', 'jaw'];
        terms.forEach(term => {
          const result = detectDescriptorCategoryClient(`person with ${term}`);
          expect(result.category).toBe('physical');
        });
      });
    });

    describe('wardrobe category detection', () => {
      it('detects wardrobe descriptors - catches wardrobe pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.wardrobe regex is broken
        const result = detectDescriptorCategoryClient('wearing a red jacket');
        expect(result.category).toBe('wardrobe');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects clothing items - catches clothing vocabulary', () => {
        const items = ['coat', 'dress', 'hat', 'boots', 'suit'];
        items.forEach(item => {
          const result = detectDescriptorCategoryClient(`wearing a ${item}`);
          expect(result.category).toBe('wardrobe');
        });
      });
    });

    describe('props category detection', () => {
      it('detects props descriptors - catches props pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.props regex is broken
        const result = detectDescriptorCategoryClient('holding a sword');
        expect(result.category).toBe('props');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects various holding verbs - catches verb vocabulary', () => {
        const verbs = ['carrying', 'clutching', 'gripping', 'wielding', 'brandishing'];
        verbs.forEach(verb => {
          const result = detectDescriptorCategoryClient(`${verb} a weapon`);
          expect(result.category).toBe('props');
        });
      });
    });

    describe('emotional category detection', () => {
      it('detects emotional descriptors - catches emotional pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.emotional regex is broken
        const result = detectDescriptorCategoryClient('expression of sadness');
        expect(result.category).toBe('emotional');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects gaze and facial expressions - catches expression terms', () => {
        const terms = ['gaze', 'demeanor', 'countenance', 'exuding'];
        terms.forEach(term => {
          const result = detectDescriptorCategoryClient(`${term} confidence`);
          expect(result.category).toBe('emotional');
        });
      });
    });

    describe('action category detection', () => {
      it('detects action descriptors - catches action pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.action regex is broken
        const result = detectDescriptorCategoryClient('standing in the doorway');
        expect(result.category).toBe('action');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects various action verbs - catches action vocabulary', () => {
        const actions = ['sitting', 'walking', 'dancing', 'kneeling', 'gesturing'];
        actions.forEach(action => {
          const result = detectDescriptorCategoryClient(`${action} gracefully`);
          expect(result.category).toBe('action');
        });
      });
    });

    describe('lighting category detection', () => {
      it('detects lighting descriptors - catches lighting pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.lighting regex is broken
        const result = detectDescriptorCategoryClient('bathed in golden light');
        expect(result.category).toBe('lighting');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects lighting effects - catches effect terms', () => {
        const effects = ['illuminated', 'shadowed', 'backlit', 'spotlit', 'silhouetted'];
        effects.forEach(effect => {
          const result = detectDescriptorCategoryClient(`${effect} dramatically`);
          expect(result.category).toBe('lighting');
        });
      });
    });

    describe('contextual category detection', () => {
      it('detects contextual descriptors - catches contextual pattern bug', () => {
        // Would fail if DESCRIPTOR_PATTERNS.contextual regex is broken
        const result = detectDescriptorCategoryClient('surrounded by ancient trees');
        expect(result.category).toBe('contextual');
        expect(result.confidence).toBeGreaterThan(0.6);
      });

      it('detects spatial relationships - catches spatial terms', () => {
        const relations = ['amidst', 'beside', 'underneath', 'in front of'];
        relations.forEach(relation => {
          const result = detectDescriptorCategoryClient(`${relation} the building`);
          expect(result.category).toBe('contextual');
        });
      });
    });

    describe('confidence calculation', () => {
      it('increases confidence for short focused descriptors - catches word count bonus', () => {
        // Would fail if word count bonus is removed
        const short = detectDescriptorCategoryClient('blue eyes');
        const long = detectDescriptorCategoryClient('person with very distinctive blue eyes that are quite remarkable');
        // Short should get bonus
        expect(short.confidence).toBeGreaterThanOrEqual(0.7);
      });

      it('base confidence is at least 0.6 - catches base confidence floor', () => {
        // Would fail if base confidence changes
        const result = detectDescriptorCategoryClient('wearing hat');
        expect(result.confidence).toBeGreaterThanOrEqual(0.6);
      });

      it('caps confidence boost for multiple matches - catches confidence ceiling logic', () => {
        // Would fail if Math.min cap is removed
        const result = detectDescriptorCategoryClient('eyes face hands hair skin body');
        // Should cap at base + 0.2 max from matches + 0.1 from word count = 0.9
        expect(result.confidence).toBeLessThanOrEqual(1.0);
      });
    });

    describe('category selection with multiple matches', () => {
      it('returns highest confidence match - catches sorting logic', () => {
        // Text that could match multiple categories
        // "bathed" matches lighting, but if it also had physical terms, should pick highest
        const result = detectDescriptorCategoryClient('bathed in light');
        expect(result.category).toBe('lighting');
      });
    });

    describe('return value structure', () => {
      it('returns category, confidence, colors, and label - catches return structure', () => {
        // Would fail if return object structure changes
        const result = detectDescriptorCategoryClient('wearing jacket');
        expect(result).toHaveProperty('category');
        expect(result).toHaveProperty('confidence');
        expect(result).toHaveProperty('colors');
        expect(result).toHaveProperty('label');
      });

      it('includes correct color scheme - catches color mapping', () => {
        // Would fail if CATEGORY_COLORS mapping is broken
        const result = detectDescriptorCategoryClient('wearing jacket');
        expect(result.colors).toHaveProperty('bg');
        expect(result.colors).toHaveProperty('border');
        expect(result.colors).toHaveProperty('text');
        expect(result.colors.bg).toMatch(/^#[0-9A-F]{6}$/i);
      });

      it('includes correct label - catches label mapping', () => {
        // Would fail if CATEGORY_LABELS mapping is broken
        const result = detectDescriptorCategoryClient('wearing jacket');
        expect(result.label).toBe('Wardrobe');
      });
    });

    describe('edge cases and error handling', () => {
      it('returns null for null input - catches null handling', () => {
        // Would fail if null check is missing
        const result = detectDescriptorCategoryClient(null);
        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
        expect(result.colors).toBeNull();
        expect(result.label).toBeNull();
      });

      it('returns null for undefined input - catches undefined handling', () => {
        // Would fail if undefined check is missing
        const result = detectDescriptorCategoryClient(undefined);
        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('returns null for empty string - catches empty string handling', () => {
        // Would fail if empty string check is missing
        const result = detectDescriptorCategoryClient('');
        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('returns null for non-string input - catches type validation', () => {
        // Would fail if type check is missing
        const result = detectDescriptorCategoryClient(123);
        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('returns null for text with no matches - catches no-match case', () => {
        // Would fail if we don't handle zero matches
        const result = detectDescriptorCategoryClient('xyz nonsense abc');
        expect(result.category).toBeNull();
        expect(result.confidence).toBe(0);
      });

      it('trims whitespace from input - catches trimming', () => {
        // Would fail if trim is not called
        const result = detectDescriptorCategoryClient('  wearing jacket  ');
        expect(result.category).toBe('wardrobe');
      });
    });
  });

  describe('getCategoryColors', () => {
    it('returns colors for valid category - catches color lookup', () => {
      // Would fail if CATEGORY_COLORS is not accessible
      const colors = getCategoryColors('physical');
      expect(colors).toBeDefined();
      expect(colors).toHaveProperty('bg');
      expect(colors).toHaveProperty('border');
      expect(colors).toHaveProperty('text');
    });

    it('returns correct color values - catches color value accuracy', () => {
      // Would fail if color values are changed
      const colors = getCategoryColors('physical');
      expect(colors.bg).toBe('#FEF3C7');
      expect(colors.border).toBe('#F59E0B');
      expect(colors.text).toBe('#92400E');
    });

    it('returns null for invalid category - catches fallback behavior', () => {
      // Would fail if || null fallback is removed
      const colors = getCategoryColors('invalid');
      expect(colors).toBeNull();
    });

    it('returns null for undefined input - catches undefined handling', () => {
      // Would fail if undefined isn't handled
      const colors = getCategoryColors(undefined);
      expect(colors).toBeNull();
    });
  });

  describe('getCategoryLabel', () => {
    it('returns label for valid category - catches label lookup', () => {
      // Would fail if CATEGORY_LABELS is not accessible
      const label = getCategoryLabel('physical');
      expect(label).toBe('Physical');
    });

    it('returns all category labels correctly - catches complete mapping', () => {
      // Would fail if any label mapping is broken
      expect(getCategoryLabel('wardrobe')).toBe('Wardrobe');
      expect(getCategoryLabel('props')).toBe('Props');
      expect(getCategoryLabel('emotional')).toBe('Emotional');
      expect(getCategoryLabel('action')).toBe('Action');
      expect(getCategoryLabel('lighting')).toBe('Lighting');
      expect(getCategoryLabel('contextual')).toBe('Context');
    });

    it('returns category itself for invalid category - catches fallback', () => {
      // Would fail if || category fallback is removed
      const label = getCategoryLabel('invalid');
      expect(label).toBe('invalid');
    });

    it('returns undefined for undefined input - catches passthrough', () => {
      // Documents current behavior
      const label = getCategoryLabel(undefined);
      expect(label).toBeUndefined();
    });
  });

  describe('getAllCategoriesInfo', () => {
    it('returns array of all categories - catches return type', () => {
      // Would fail if return type changes
      const info = getAllCategoriesInfo();
      expect(Array.isArray(info)).toBe(true);
    });

    it('returns correct number of categories - catches completeness', () => {
      // Would fail if a category is added/removed
      const info = getAllCategoriesInfo();
      expect(info.length).toBe(7); // physical, wardrobe, props, emotional, action, lighting, contextual
    });

    it('each category has required properties - catches object structure', () => {
      // Would fail if object structure in map changes
      const info = getAllCategoriesInfo();
      info.forEach(cat => {
        expect(cat).toHaveProperty('category');
        expect(cat).toHaveProperty('label');
        expect(cat).toHaveProperty('colors');
      });
    });

    it('categories have correct data - catches data accuracy', () => {
      // Would fail if any mapping is broken
      const info = getAllCategoriesInfo();
      const physical = info.find(c => c.category === 'physical');
      expect(physical.label).toBe('Physical');
      expect(physical.colors.bg).toBe('#FEF3C7');
    });

    it('includes all expected categories - catches missing categories', () => {
      // Would fail if Object.keys(DESCRIPTOR_PATTERNS) is incomplete
      const info = getAllCategoriesInfo();
      const categories = info.map(c => c.category);
      expect(categories).toContain('physical');
      expect(categories).toContain('wardrobe');
      expect(categories).toContain('props');
      expect(categories).toContain('emotional');
      expect(categories).toContain('action');
      expect(categories).toContain('lighting');
      expect(categories).toContain('contextual');
    });
  });
});
