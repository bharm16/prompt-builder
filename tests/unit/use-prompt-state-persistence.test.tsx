import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePromptStatePersistence } from '@features/prompt-optimizer/context/hooks/usePromptStatePersistence';

const SELECTED_MODEL_KEY = 'prompt-optimizer:selectedModel';
const GENERATION_PARAMS_KEY = 'prompt-optimizer:generationParams';

describe('usePromptStatePersistence', () => {
  const originalSetItem = localStorage.setItem;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.setItem = originalSetItem;
  });

  describe('error handling', () => {
    it('avoids persisting the selected model when storage throws', () => {
      localStorage.setItem = vi.fn((key: string) => {
        if (key === SELECTED_MODEL_KEY) {
          throw new Error('Write failure');
        }
      }) as typeof localStorage.setItem;

      renderHook(() =>
        usePromptStatePersistence({
          selectedModel: 'model-a',
          generationParams: { steps: 5 },
        })
      );

      expect(localStorage.getItem(SELECTED_MODEL_KEY)).toBeNull();
    });

    it('avoids persisting generation params when storage throws', () => {
      localStorage.setItem = vi.fn((key: string) => {
        if (key === GENERATION_PARAMS_KEY) {
          throw new Error('Write failure');
        }
      }) as typeof localStorage.setItem;

      renderHook(() =>
        usePromptStatePersistence({
          selectedModel: 'model-b',
          generationParams: { steps: 7 },
        })
      );

      expect(localStorage.getItem(GENERATION_PARAMS_KEY)).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('persists an empty model string safely', () => {
      renderHook(() =>
        usePromptStatePersistence({
          selectedModel: '',
          generationParams: { steps: 2 },
        })
      );

      expect(localStorage.getItem(SELECTED_MODEL_KEY)).toBe('');
    });

    it('persists empty generation params as an empty object', () => {
      renderHook(() =>
        usePromptStatePersistence({
          selectedModel: 'model-c',
          generationParams: {},
        })
      );

      expect(localStorage.getItem(GENERATION_PARAMS_KEY)).toBe('{}');
    });
  });

  describe('core behavior', () => {
    it('updates persisted state when inputs change', () => {
      const { rerender } = renderHook(
        ({ selectedModel, generationParams }) =>
          usePromptStatePersistence({ selectedModel, generationParams }),
        {
          initialProps: { selectedModel: 'model-a', generationParams: { steps: 1 } },
        }
      );

      expect(localStorage.getItem(SELECTED_MODEL_KEY)).toBe('model-a');
      expect(localStorage.getItem(GENERATION_PARAMS_KEY)).toBe('{"steps":1}');

      rerender({ selectedModel: 'model-b', generationParams: { steps: 2 } });

      expect(localStorage.getItem(SELECTED_MODEL_KEY)).toBe('model-b');
      expect(localStorage.getItem(GENERATION_PARAMS_KEY)).toBe('{"steps":2}');
    });
  });
});
