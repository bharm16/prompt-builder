import { describe, it, expect } from 'vitest';
import { ConstraintGenerationService } from '@services/video-prompt-analysis/services/analysis/ConstraintGenerationService';

function createService(): ConstraintGenerationService {
  return new ConstraintGenerationService();
}

describe('ConstraintGenerationService', () => {
  // ===========================================================================
  // ERROR HANDLING & INVALID INPUT (~50%)
  // ===========================================================================
  describe('error handling and invalid input', () => {
    it('returns valid constraint config when details is empty object', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({}, {});
      expect(result.mode).toBeDefined();
      expect(result.minWords).toBeGreaterThanOrEqual(1);
      expect(result.maxWords).toBeGreaterThanOrEqual(result.minWords);
      expect(result.maxSentences).toBeGreaterThanOrEqual(1);
      expect(typeof result.slotDescriptor).toBe('string');
    });

    it('handles non-finite highlightWordCount by falling back to text count', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: NaN,
        highlightedText: 'one two three',
      });
      expect(result.minWords).toBeGreaterThanOrEqual(1);
      expect(result.maxWords).toBeGreaterThanOrEqual(result.minWords);
    });

    it('handles Infinity highlightWordCount by falling back to text count', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: Infinity,
        highlightedText: 'hello world',
      });
      expect(result.minWords).toBeGreaterThanOrEqual(1);
    });

    it('handles negative highlightWordCount by clamping to 0', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({ highlightWordCount: -5 });
      expect(result.minWords).toBeGreaterThanOrEqual(1);
      expect(result.maxWords).toBeGreaterThanOrEqual(result.minWords);
    });

    it('falls back to phrase mode when forceMode is unknown', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints(
        { highlightWordCount: 3 },
        { forceMode: 'nonexistent_mode_xyz' }
      );
      expect(result.mode).toBe('phrase');
    });

    it('handles undefined highlightedText gracefully', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedText: undefined,
        highlightWordCount: 0,
      });
      expect(result.mode).toBeDefined();
      expect(result.slotDescriptor).toBe('visual detail');
    });

    it('treats unreliable category confidence (below 0.45) as untrusted', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'lighting',
        highlightedCategoryConfidence: 0.1,
        highlightWordCount: 5,
      });
      // Low confidence means lighting category should not drive mode selection
      expect(result.mode).not.toBe('lighting');
    });

    it('treats null confidence as reliable (trusts the category)', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'lighting setup',
        highlightedCategoryConfidence: null,
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('lighting');
    });

    it('treats undefined confidence as reliable (trusts the category)', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'lighting setup',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('lighting');
    });

    it('treats NaN confidence as reliable', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'lighting setup',
        highlightedCategoryConfidence: NaN,
        highlightWordCount: 5,
      });
      // NaN is not finite, so _isCategoryReliable returns true
      expect(result.mode).toBe('lighting');
    });
  });

  // ===========================================================================
  // EDGE CASES (~30%)
  // ===========================================================================
  describe('edge cases', () => {
    it('minWords is always <= maxWords for all forced modes', () => {
      const service = createService();
      const modes = ['micro', 'lighting', 'camera', 'location', 'style', 'phrase', 'sentence'];
      for (const mode of modes) {
        const result = service.getVideoReplacementConstraints(
          { highlightWordCount: 1 },
          { forceMode: mode }
        );
        expect(result.minWords).toBeLessThanOrEqual(
          result.maxWords,
          `Failed for mode: ${mode}`
        );
      }
    });

    it('minWords >= 1 even with 0 word count', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints(
        { highlightWordCount: 0 },
        { forceMode: 'micro' }
      );
      expect(result.minWords).toBeGreaterThanOrEqual(1);
    });

    it('uses phraseRole as slotDescriptor when present', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        phraseRole: 'camera movement',
        highlightWordCount: 3,
      });
      expect(result.slotDescriptor).toBe('camera movement');
    });

    it('uses highlightedCategory + "detail" as slotDescriptor when phraseRole absent', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'environment',
        highlightWordCount: 3,
      });
      expect(result.slotDescriptor).toBe('environment detail');
    });

    it('defaults slotDescriptor to "visual detail" when both role and category absent', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({ highlightWordCount: 3 });
      expect(result.slotDescriptor).toBe('visual detail');
    });

    it('very short highlights (<=3 words) get micro mode', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: 2,
        highlightedText: 'red car',
      });
      expect(result.mode).toBe('micro');
    });

    it('boundary: 3 words is still very short (micro)', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: 3,
        highlightedText: 'big red car',
      });
      expect(result.mode).toBe('micro');
    });

    it('boundary: 4 words is not very short (falls through to other rules)', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: 4,
        highlightedText: 'the big red car',
      });
      // 4 words, no category match, not a sentence, within phrase threshold
      expect(result.mode).toBe('phrase');
    });
  });

  // ===========================================================================
  // CORE BEHAVIOR - CATEGORY-BASED MODE SELECTION (~20%)
  // ===========================================================================
  describe('category-based auto-selection', () => {
    it('selects micro for subject category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'subject description',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('micro');
    });

    it('selects micro for character category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'character detail',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('micro');
    });

    it('selects lighting for lighting category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'lighting setup',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('lighting');
    });

    it('selects micro for shot category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'shot type',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('micro');
    });

    it('selects camera for camera category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'camera movement',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('camera');
    });

    it('selects camera for framing category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'framing choice',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('camera');
    });

    it('selects location for environment category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'environment setting',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('location');
    });

    it('selects location for location category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'location detail',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('location');
    });

    it('selects style for style category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'style reference',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('style');
    });

    it('selects style for tone category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'tone descriptor',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('style');
    });

    it('selects style for audio category', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightedCategory: 'audio score',
        highlightWordCount: 5,
      });
      expect(result.mode).toBe('style');
    });

    it('selects phrase for non-sentence text within phrase threshold', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: 6,
        highlightedText: 'warm golden light from the west',
      });
      expect(result.mode).toBe('phrase');
    });

    it('selects sentence for long sentence-like text', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints({
        highlightWordCount: 15,
        highlightedText:
          'The camera slowly pans across the ruins as golden light filters through broken arches.',
      });
      expect(result.mode).toBe('sentence');
    });

    it('forceMode overrides auto-selection', () => {
      const service = createService();
      const result = service.getVideoReplacementConstraints(
        { highlightedCategory: 'lighting', highlightWordCount: 5 },
        { forceMode: 'camera' }
      );
      expect(result.mode).toBe('camera');
    });
  });
});
