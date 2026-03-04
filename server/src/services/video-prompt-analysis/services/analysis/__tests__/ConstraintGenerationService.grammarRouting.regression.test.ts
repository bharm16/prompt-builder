import { describe, expect, it } from 'vitest';
import { ConstraintGenerationService } from '../ConstraintGenerationService';

describe('ConstraintGenerationService grammar-aware routing regression', () => {
  const service = new ConstraintGenerationService();

  it('routes action.movement spans to verb mode', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 2,
      highlightedText: 'swaying gently',
      highlightedCategory: 'action.movement',
      highlightedCategoryConfidence: 0.8,
    });

    expect(result.mode).toBe('verb');
    expect(result.formRequirement).toContain('verb phrase');
  });

  it('routes action.gesture spans to verb mode', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 3,
      highlightedText: 'firmly grip the',
      highlightedCategory: 'action.gesture',
      highlightedCategoryConfidence: 0.7,
    });

    expect(result.mode).toBe('verb');
  });

  it('routes very-short style spans to adjective mode', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 1,
      highlightedText: 'warm',
      highlightedCategory: 'style.aesthetic',
      highlightedCategoryConfidence: 0.6,
    });

    expect(result.mode).toBe('adjective');
    expect(result.formRequirement).toContain('adjective');
  });

  it('routes longer style spans to style mode (not adjective)', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 5,
      highlightedText: 'cinematic golden hour look',
      highlightedCategory: 'style.aesthetic',
      highlightedCategoryConfidence: 0.8,
    });

    expect(result.mode).toBe('style');
  });

  it('routes subject spans to micro mode (noun phrases)', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 2,
      highlightedText: 'young girl',
      highlightedCategory: 'subject.appearance',
      highlightedCategoryConfidence: 0.9,
    });

    expect(result.mode).toBe('micro');
  });

  it('verb mode has extraRequirements instructing verb phrase output', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 2,
      highlightedText: 'running fast',
      highlightedCategory: 'action.physical',
      highlightedCategoryConfidence: 0.8,
    });

    expect(result.extraRequirements).toEqual(
      expect.arrayContaining([expect.stringContaining('verb phrase')])
    );
  });

  it('adjective mode has extraRequirements instructing adjective phrase output', () => {
    const result = service.getVideoReplacementConstraints({
      highlightWordCount: 1,
      highlightedText: 'moody',
      highlightedCategory: 'tone',
      highlightedCategoryConfidence: 0.7,
    });

    // 'tone' doesn't match style, so it won't get adjective mode
    // Let's test with explicit style category
    const styleResult = service.getVideoReplacementConstraints({
      highlightWordCount: 1,
      highlightedText: 'moody',
      highlightedCategory: 'style.mood',
      highlightedCategoryConfidence: 0.7,
    });

    expect(styleResult.mode).toBe('adjective');
    expect(styleResult.extraRequirements).toEqual(
      expect.arrayContaining([expect.stringContaining('adjective')])
    );
  });
});
