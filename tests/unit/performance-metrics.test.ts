import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  markOptimizationStart,
  markDraftReady,
  markRefinementComplete,
  markSpansReceived,
  measureOptimizeToDraft,
  measureDraftToRefined,
  measureOptimizeToRefinedTotal,
} from '@hooks/utils/performanceMetrics';

describe('performanceMetrics', () => {
  beforeEach(() => {
    performance.clearMarks();
    performance.clearMeasures();
  });

  describe('error handling - missing marks', () => {
    it('measureOptimizeToDraft does not throw when optimize-start mark is missing', () => {
      markDraftReady();
      expect(() => measureOptimizeToDraft()).not.toThrow();
    });

    it('measureDraftToRefined does not throw when draft-ready mark is missing', () => {
      markRefinementComplete();
      expect(() => measureDraftToRefined()).not.toThrow();
    });

    it('measureOptimizeToRefinedTotal does not throw when marks are missing', () => {
      expect(() => measureOptimizeToRefinedTotal()).not.toThrow();
    });

    it('measureOptimizeToDraft skips measurement when optimize-start mark absent', () => {
      markDraftReady();
      measureOptimizeToDraft();
      const measures = performance.getEntriesByName('optimize-to-draft', 'measure');
      expect(measures).toHaveLength(0);
    });

    it('measureDraftToRefined skips measurement when draft-ready mark absent', () => {
      markRefinementComplete();
      measureDraftToRefined();
      const measures = performance.getEntriesByName('draft-to-refined', 'measure');
      expect(measures).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('markSpansReceived creates a mark with the source suffix', () => {
      markSpansReceived('draft');
      markSpansReceived('refined');
      const draftMarks = performance.getEntriesByName('spans-received-draft', 'mark');
      const refinedMarks = performance.getEntriesByName('spans-received-refined', 'mark');
      expect(draftMarks.length).toBeGreaterThan(0);
      expect(refinedMarks.length).toBeGreaterThan(0);
    });

    it('calling mark functions multiple times does not throw', () => {
      expect(() => {
        markOptimizationStart();
        markOptimizationStart();
        markDraftReady();
        markDraftReady();
      }).not.toThrow();
    });
  });

  describe('core measurement flow', () => {
    it('measureOptimizeToDraft creates a measure between start and draft marks', () => {
      markOptimizationStart();
      markDraftReady();
      measureOptimizeToDraft();
      const measures = performance.getEntriesByName('optimize-to-draft', 'measure');
      expect(measures).toHaveLength(1);
      expect(measures[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('measureDraftToRefined creates a measure between draft and refined marks', () => {
      markDraftReady();
      markRefinementComplete();
      measureDraftToRefined();
      const measures = performance.getEntriesByName('draft-to-refined', 'measure');
      expect(measures).toHaveLength(1);
    });

    it('measureOptimizeToRefinedTotal creates a measure from start to refined', () => {
      markOptimizationStart();
      markRefinementComplete();
      measureOptimizeToRefinedTotal();
      const measures = performance.getEntriesByName('optimize-to-refined-total', 'measure');
      expect(measures).toHaveLength(1);
    });
  });
});
