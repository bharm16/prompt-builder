import { describe, it, expect } from 'vitest';
import { FallbackStrategyService } from '@services/video-prompt-analysis/services/guidance/FallbackStrategyService';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions } from '@services/video-prompt-analysis/types';

function createService(): FallbackStrategyService {
  return new FallbackStrategyService();
}

function mockGetConstraints(details: ConstraintDetails, options: ConstraintOptions): ConstraintConfig {
  return {
    mode: options.forceMode ?? 'default',
    minWords: 3,
    maxWords: 10,
    maxSentences: 1,
    slotDescriptor: 'test slot',
  };
}

describe('FallbackStrategyService', () => {
  // ===========================================================================
  // ERROR HANDLING & INVALID INPUT (~50%)
  // ===========================================================================
  describe('error handling and invalid input', () => {
    it('returns null when all fallback modes have been attempted', () => {
      const service = createService();
      const attempted = new Set(['phrase', 'micro']);
      const result = service.getVideoFallbackConstraints(
        { mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test' },
        {},
        attempted,
        mockGetConstraints
      );
      expect(result).toBeNull();
    });

    it('returns null when current mode is micro (no fallbacks available)', () => {
      const service = createService();
      const result = service.getVideoFallbackConstraints(
        { mode: 'micro', minWords: 2, maxWords: 8, maxSentences: 1, slotDescriptor: 'test' },
        {},
        new Set(),
        mockGetConstraints
      );
      expect(result).toBeNull();
    });

    it('handles null currentConstraints by using default fallback order', () => {
      const service = createService();
      const result = service.getVideoFallbackConstraints(
        null,
        {},
        new Set(),
        mockGetConstraints
      );
      // Default fallback order is ['phrase', 'micro'], should return phrase
      expect(result).not.toBeNull();
      expect(result!.mode).toBe('phrase');
    });

    it('handles undefined currentConstraints by using default fallback order', () => {
      const service = createService();
      const result = service.getVideoFallbackConstraints(
        undefined,
        {},
        new Set(),
        mockGetConstraints
      );
      expect(result).not.toBeNull();
      expect(result!.mode).toBe('phrase');
    });

    it('handles empty attemptedModes set', () => {
      const service = createService();
      const result = service.getVideoFallbackConstraints(
        { mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test' },
        {},
        new Set(),
        mockGetConstraints
      );
      // First fallback for sentence is 'phrase'
      expect(result).not.toBeNull();
      expect(result!.mode).toBe('phrase');
    });
  });

  // ===========================================================================
  // EDGE CASES (~30%)
  // ===========================================================================
  describe('edge cases', () => {
    it('skips already-attempted modes and returns next available', () => {
      const service = createService();
      const attempted = new Set(['phrase']);
      const result = service.getVideoFallbackConstraints(
        { mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test' },
        {},
        attempted,
        mockGetConstraints
      );
      // Sentence fallback: ['phrase', 'micro']. phrase is attempted, so should return micro
      expect(result).not.toBeNull();
      expect(result!.mode).toBe('micro');
    });

    it('passes details through to constraint generator function', () => {
      const service = createService();
      const details: ConstraintDetails = { highlightWordCount: 7, phraseRole: 'lighting' };
      let receivedDetails: ConstraintDetails | undefined;
      const constraintsFn = (d: ConstraintDetails, o: ConstraintOptions): ConstraintConfig => {
        receivedDetails = d;
        return mockGetConstraints(d, o);
      };

      service.getVideoFallbackConstraints(
        { mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test' },
        details,
        new Set(),
        constraintsFn
      );

      expect(receivedDetails).toEqual(details);
    });

    it('passes forceMode in options to constraint generator function', () => {
      const service = createService();
      let receivedOptions: ConstraintOptions | undefined;
      const constraintsFn = (d: ConstraintDetails, o: ConstraintOptions): ConstraintConfig => {
        receivedOptions = o;
        return mockGetConstraints(d, o);
      };

      service.getVideoFallbackConstraints(
        { mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test' },
        {},
        new Set(),
        constraintsFn
      );

      expect(receivedOptions?.forceMode).toBe('phrase');
    });
  });

  // ===========================================================================
  // CORE BEHAVIOR - FALLBACK CHAINS (~20%)
  // ===========================================================================
  describe('fallback chains', () => {
    it('sentence falls back to phrase first, then micro', () => {
      const service = createService();
      const sentenceConstraint: ConstraintConfig = {
        mode: 'sentence', minWords: 10, maxWords: 25, maxSentences: 1, slotDescriptor: 'test',
      };

      // First fallback: phrase
      const first = service.getVideoFallbackConstraints(
        sentenceConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('phrase');

      // Second fallback: micro
      const second = service.getVideoFallbackConstraints(
        sentenceConstraint, {}, new Set(['phrase']), mockGetConstraints
      );
      expect(second!.mode).toBe('micro');

      // Third: exhausted
      const third = service.getVideoFallbackConstraints(
        sentenceConstraint, {}, new Set(['phrase', 'micro']), mockGetConstraints
      );
      expect(third).toBeNull();
    });

    it('phrase falls back to micro only', () => {
      const service = createService();
      const phraseConstraint: ConstraintConfig = {
        mode: 'phrase', minWords: 5, maxWords: 12, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        phraseConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('micro');

      const second = service.getVideoFallbackConstraints(
        phraseConstraint, {}, new Set(['micro']), mockGetConstraints
      );
      expect(second).toBeNull();
    });

    it('lighting falls back to micro only', () => {
      const service = createService();
      const lightingConstraint: ConstraintConfig = {
        mode: 'lighting', minWords: 6, maxWords: 14, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        lightingConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('micro');
    });

    it('camera falls back to micro only', () => {
      const service = createService();
      const cameraConstraint: ConstraintConfig = {
        mode: 'camera', minWords: 6, maxWords: 12, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        cameraConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('micro');
    });

    it('location falls back to micro only', () => {
      const service = createService();
      const locationConstraint: ConstraintConfig = {
        mode: 'location', minWords: 6, maxWords: 14, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        locationConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('micro');
    });

    it('style falls back to micro only', () => {
      const service = createService();
      const styleConstraint: ConstraintConfig = {
        mode: 'style', minWords: 5, maxWords: 12, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        styleConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('micro');
    });

    it('unknown mode uses default fallback order (phrase, micro)', () => {
      const service = createService();
      const unknownConstraint: ConstraintConfig = {
        mode: 'unknown_mode', minWords: 5, maxWords: 12, maxSentences: 1, slotDescriptor: 'test',
      };

      const first = service.getVideoFallbackConstraints(
        unknownConstraint, {}, new Set(), mockGetConstraints
      );
      expect(first!.mode).toBe('phrase');
    });
  });
});
