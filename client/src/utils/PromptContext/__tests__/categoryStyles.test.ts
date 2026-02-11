import { describe, expect, it } from 'vitest';
import { getCategoryColor, CATEGORY_COLORS } from '../categoryStyles';
import { categoryColors, DEFAULT_CATEGORY_COLOR } from '@/features/prompt-optimizer/config/categoryColors';

describe('PromptContext categoryStyles', () => {
  it('maps legacy category ids to corresponding taxonomy colors', () => {
    expect(getCategoryColor('location')).toEqual(categoryColors.environment);
    expect(getCategoryColor('time')).toEqual(categoryColors.lighting);
    expect(getCategoryColor('mood')).toEqual(categoryColors.style);
    expect(getCategoryColor('event')).toEqual(categoryColors.action);
    expect(getCategoryColor('quality')).toEqual(categoryColors.technical);
  });

  it('resolves taxonomy attributes to their parent category color', () => {
    expect(getCategoryColor('subject.wardrobe')).toEqual(categoryColors.subject);
    expect(getCategoryColor('camera.movement')).toEqual(categoryColors.camera);
    expect(getCategoryColor('lighting.timeOfDay')).toEqual(categoryColors.lighting);
  });

  it('returns fallback color for invalid categories', () => {
    expect(getCategoryColor('not-a-category')).toEqual(DEFAULT_CATEGORY_COLOR);
    expect(getCategoryColor('subject.')).toEqual(DEFAULT_CATEGORY_COLOR);
  });

  it('CATEGORY_COLORS export stays aligned with getCategoryColor', () => {
    expect(CATEGORY_COLORS('style')).toEqual(getCategoryColor('style'));
  });
});
