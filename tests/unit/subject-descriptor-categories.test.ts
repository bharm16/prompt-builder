import { describe, it, expect } from 'vitest';

import {
  detectDescriptorCategoryClient,
  getCategoryColors,
  getCategoryLabel,
  getAllCategoriesInfo,
} from '@/utils/subjectDescriptorCategories';

describe('subjectDescriptorCategories', () => {
  describe('error handling', () => {
    it('returns empty metadata when text is missing', () => {
      expect(detectDescriptorCategoryClient(null)).toEqual({
        category: null,
        confidence: 0,
        colors: null,
        label: null,
      });
    });

    it('returns null colors for unknown categories', () => {
      expect(getCategoryColors('unknown')).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('returns higher confidence for short descriptors', () => {
      const result = detectDescriptorCategoryClient('wearing coat');

      expect(result.category).toBe('wardrobe');
      expect(result.confidence).toBeGreaterThan(0.7);
      expect(result.label).toBe('Wardrobe');
    });

    it('preserves labels for unknown categories', () => {
      expect(getCategoryLabel('custom')).toBe('custom');
    });
  });

  describe('core behavior', () => {
    it('returns the metadata for each known category', () => {
      const categories = getAllCategoriesInfo();

      expect(categories).toHaveLength(7);
      expect(categories.map((entry) => entry.label)).toEqual(
        expect.arrayContaining(['Physical', 'Wardrobe', 'Props', 'Emotional', 'Action', 'Lighting', 'Context'])
      );
    });
  });
});
