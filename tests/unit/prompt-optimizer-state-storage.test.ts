import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';

import {
  loadGenerationParams,
  loadSelectedModel,
  persistGenerationParams,
  persistSelectedModel,
} from '@features/prompt-optimizer/context/promptStateStorage';

describe('promptStateStorage', () => {
  const originalGetItem = localStorage.getItem;
  const originalSetItem = localStorage.setItem;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.getItem = originalGetItem;
    localStorage.setItem = originalSetItem;
  });

  describe('error handling', () => {
    it('returns an empty model string when storage access fails', () => {
      localStorage.getItem = vi.fn(() => {
        throw new Error('Read failure');
      });

      expect(loadSelectedModel()).toBe('');
    });

    it('returns empty params when storage access fails', () => {
      localStorage.getItem = vi.fn(() => {
        throw new Error('Read failure');
      });

      expect(loadGenerationParams()).toEqual({});
    });

    it('returns empty params when JSON parsing fails', () => {
      localStorage.setItem('prompt-optimizer:generationParams', '{not-json');

      expect(loadGenerationParams()).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('returns empty defaults when no values are stored', () => {
      expect(loadSelectedModel()).toBe('');
      expect(loadGenerationParams()).toEqual({});
    });

    it('stores and loads an empty generation params object', () => {
      persistGenerationParams({});

      expect(loadGenerationParams()).toEqual({});
    });
  });

  describe('core behavior', () => {
    it('round-trips the selected model value', () => {
      persistSelectedModel('model-a');

      expect(loadSelectedModel()).toBe('model-a');
    });

    it('round-trips generation params with property-based coverage', () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1 }), fc.oneof(fc.string(), fc.integer(), fc.boolean())),
          (params) => {
            persistGenerationParams(params);
            expect(loadGenerationParams()).toEqual(params);
          }
        )
      );
    });
  });
});
