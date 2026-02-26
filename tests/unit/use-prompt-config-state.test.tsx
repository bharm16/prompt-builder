import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';

import { usePromptConfigState } from '@features/prompt-optimizer/context/hooks/usePromptConfigState';
import { GenerationControlsStoreProvider } from '@features/prompt-optimizer/context/GenerationControlsStore';
import { persistGenerationParams, persistSelectedModel } from '@features/prompt-optimizer/context/promptStateStorage';

const SELECTED_MODEL_KEY = 'prompt-optimizer:selectedModel';
const GENERATION_PARAMS_KEY = 'prompt-optimizer:generationParams';

describe('usePromptConfigState', () => {
  const originalGetItem = localStorage.getItem;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GenerationControlsStoreProvider>{children}</GenerationControlsStoreProvider>
  );

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.getItem = originalGetItem;
  });

  describe('error handling', () => {
    it('falls back to defaults when localStorage access fails', () => {
      localStorage.getItem = vi.fn(() => {
        throw new Error('Storage failure');
      });

      const { result } = renderHook(() => usePromptConfigState(), { wrapper });

      expect(result.current.selectedModel).toBe('');
      expect(result.current.generationParams).toEqual({});
    });

    it('ignores invalid generation params JSON', () => {
      localStorage.setItem(GENERATION_PARAMS_KEY, '{not-json');

      const { result } = renderHook(() => usePromptConfigState(), { wrapper });

      expect(result.current.generationParams).toEqual({});
    });
  });

  describe('edge cases', () => {
    it('defaults to the video mode and empty config when storage is empty', () => {
      const { result } = renderHook(() => usePromptConfigState(), { wrapper });

      expect(result.current.selectedMode).toBe('video');
      expect(result.current.selectedModel).toBe('');
      expect(result.current.generationParams).toEqual({});
    });

    it('hydrates model and params from persisted storage', () => {
      persistSelectedModel('model-a');
      persistGenerationParams({ steps: 12 });

      const { result } = renderHook(() => usePromptConfigState(), { wrapper });

      expect(result.current.selectedModel).toBe('model-a');
      expect(result.current.generationParams).toEqual({ steps: 12 });
    });
  });

  describe('core behavior', () => {
    it('updates configuration state via setters', () => {
      const { result } = renderHook(() => usePromptConfigState(), { wrapper });

      act(() => {
        result.current.setSelectedMode('image');
        result.current.setSelectedModel('model-b');
        result.current.setGenerationParams({ temperature: 0.7 });
      });

      expect(result.current.selectedMode).toBe('image');
      expect(result.current.selectedModel).toBe('model-b');
      expect(result.current.generationParams).toEqual({ temperature: 0.7 });
    });
  });
});
