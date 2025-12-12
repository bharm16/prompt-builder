import { describe, it, expect } from 'vitest';
import {
  detectDescriptorCategoryClient,
  getCategoryColors,
  getCategoryLabel,
  getAllCategoriesInfo,
} from '../subjectDescriptorCategories';

describe('subjectDescriptorCategories', () => {
  it('returns null category for empty or non-string input', () => {
    expect(detectDescriptorCategoryClient(null).category).toBeNull();
    expect(detectDescriptorCategoryClient('').category).toBeNull();
  });

  it('detects a simple physical descriptor and returns metadata', () => {
    const result = detectDescriptorCategoryClient('blue eyes');
    expect(result.category).toBe('physical');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.colors).toBeTruthy();
    expect(result.label).toBe('Physical');
  });

  it('exposes colors and labels for known categories', () => {
    expect(getCategoryColors('wardrobe')).toEqual(
      expect.objectContaining({ bg: expect.any(String) })
    );
    expect(getCategoryLabel('props')).toBe('Props');
  });

  it('lists all categories with metadata', () => {
    const all = getAllCategoriesInfo();
    expect(all.length).toBeGreaterThan(0);
    expect(all[0]).toHaveProperty('category');
    expect(all[0]).toHaveProperty('label');
    expect(all[0]).toHaveProperty('colors');
  });
});

