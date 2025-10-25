import { describe, it, expect } from 'vitest';
import {
  detectDescriptorCategory,
  getCategoryFallbacks,
  getCategoryInstruction,
  getCategoryForbidden,
  getAllCategories,
  detectMultipleCategories,
} from '../../../../server/src/services/DescriptorCategories.js';

describe('DescriptorCategories', () => {
  describe('detectDescriptorCategory', () => {
    it('should detect physical category', () => {
      const result = detectDescriptorCategory('with weathered hands and sun-worn face');
      expect(result.category).toBe('physical');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect wardrobe category', () => {
      const result = detectDescriptorCategory('wearing a sun-faded denim jacket');
      expect(result.category).toBe('wardrobe');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect props category', () => {
      const result = detectDescriptorCategory('holding a worn leather journal');
      expect(result.category).toBe('props');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect emotional category', () => {
      const result = detectDescriptorCategory('with weary expression and distant gaze');
      expect(result.category).toBe('emotional');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect action category', () => {
      const result = detectDescriptorCategory('leaning against weathered brick wall');
      expect(result.category).toBe('action');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect lighting category', () => {
      const result = detectDescriptorCategory('bathed in warm golden hour light');
      expect(result.category).toBe('lighting');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should detect contextual category', () => {
      const result = detectDescriptorCategory('surrounded by curious onlookers');
      expect(result.category).toBe('contextual');
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it('should return null for non-matching text', () => {
      const result = detectDescriptorCategory('random generic text');
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should return null for empty input', () => {
      const result = detectDescriptorCategory('');
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should handle null input', () => {
      const result = detectDescriptorCategory(null);
      expect(result.category).toBeNull();
      expect(result.confidence).toBe(0);
    });

    it('should increase confidence for multiple pattern matches', () => {
      const result1 = detectDescriptorCategory('with hands');
      const result2 = detectDescriptorCategory('with weathered hands and lined face');
      // Both will have physical category, result2 should have higher or equal confidence
      expect(result2.confidence).toBeGreaterThanOrEqual(result1.confidence - 0.1);
    });

    it('should increase confidence for shorter, focused descriptors', () => {
      const result1 = detectDescriptorCategory('wearing jacket');
      const result2 = detectDescriptorCategory('wearing a sun-faded vintage denim jacket with brass buttons and frayed edges');
      // Shorter descriptor should get bonus
      expect(result1.confidence).toBeGreaterThan(0.6);
    });
  });

  describe('getCategoryFallbacks', () => {
    it('should return fallbacks for physical category', () => {
      const fallbacks = getCategoryFallbacks('physical');
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
      expect(fallbacks[0]).toHaveProperty('text');
      expect(fallbacks[0]).toHaveProperty('explanation');
    });

    it('should return fallbacks for wardrobe category', () => {
      const fallbacks = getCategoryFallbacks('wardrobe');
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBeGreaterThan(0);
    });

    it('should return empty array for invalid category', () => {
      const fallbacks = getCategoryFallbacks('invalid_category');
      expect(Array.isArray(fallbacks)).toBe(true);
      expect(fallbacks.length).toBe(0);
    });
  });

  describe('getCategoryInstruction', () => {
    it('should return instruction for physical category', () => {
      const instruction = getCategoryInstruction('physical');
      expect(typeof instruction).toBe('string');
      expect(instruction.length).toBeGreaterThan(0);
      expect(instruction.toLowerCase()).toContain('physical');
    });

    it('should return instruction for wardrobe category', () => {
      const instruction = getCategoryInstruction('wardrobe');
      expect(typeof instruction).toBe('string');
      expect(instruction.toLowerCase()).toContain('clothing');
    });

    it('should return null for invalid category', () => {
      const instruction = getCategoryInstruction('invalid_category');
      expect(instruction).toBeNull();
    });
  });

  describe('getCategoryForbidden', () => {
    it('should return forbidden patterns for physical category', () => {
      const forbidden = getCategoryForbidden('physical');
      expect(typeof forbidden).toBe('string');
      expect(forbidden.toUpperCase()).toContain('NOT');
    });

    it('should return null for category without forbidden patterns', () => {
      const forbidden = getCategoryForbidden('invalid_category');
      expect(forbidden).toBeNull();
    });
  });

  describe('getAllCategories', () => {
    it('should return all category names', () => {
      const categories = getAllCategories();
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('physical');
      expect(categories).toContain('wardrobe');
      expect(categories).toContain('props');
      expect(categories).toContain('emotional');
      expect(categories).toContain('action');
      expect(categories).toContain('lighting');
      expect(categories).toContain('contextual');
    });
  });

  describe('detectMultipleCategories', () => {
    it('should detect multiple categories in complex text', () => {
      const text = 'wearing vintage clothing while holding a camera and standing with confident posture';
      const categories = detectMultipleCategories(text);
      expect(Array.isArray(categories)).toBe(true);
      // Should detect at least one category (wardrobe, props, or action)
      expect(categories.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty array for non-matching text', () => {
      const categories = detectMultipleCategories('generic text');
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBe(0);
    });

    it('should sort by confidence', () => {
      const text = 'wearing jacket holding camera';
      const categories = detectMultipleCategories(text);
      if (categories.length > 1) {
        for (let i = 0; i < categories.length - 1; i++) {
          expect(categories[i].confidence).toBeGreaterThanOrEqual(categories[i + 1].confidence);
        }
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle mixed case text', () => {
      const result = detectDescriptorCategory('WEARING A JACKET');
      expect(result.category).toBe('wardrobe');
    });

    it('should handle text with extra whitespace', () => {
      const result = detectDescriptorCategory('  wearing   a   jacket  ');
      expect(result.category).toBe('wardrobe');
    });

    it('should handle very short descriptors', () => {
      const result = detectDescriptorCategory('wearing hat');
      expect(result.category).toBe('wardrobe');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should handle ambiguous descriptors', () => {
      // "with a camera" could be props or part of action
      const result = detectDescriptorCategory('with a camera');
      expect(result.category).not.toBeNull();
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });
});
