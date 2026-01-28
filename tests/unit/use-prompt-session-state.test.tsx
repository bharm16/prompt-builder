import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePromptSessionState } from '@features/prompt-optimizer/context/hooks/usePromptSessionState';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';

describe('usePromptSessionState', () => {
  describe('error handling', () => {
    it('defaults session data to null', () => {
      const { result } = renderHook(() => usePromptSessionState());

      expect(result.current.suggestionsData).toBeNull();
      expect(result.current.conceptElements).toBeNull();
      expect(result.current.promptContext).toBeNull();
    });

    it('defaults prompt identifiers to null', () => {
      const { result } = renderHook(() => usePromptSessionState());

      expect(result.current.currentPromptUuid).toBeNull();
      expect(result.current.currentPromptDocId).toBeNull();
      expect(result.current.activeVersionId).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('supports clearing session data after it has been set', () => {
      const { result } = renderHook(() => usePromptSessionState());
      const suggestions: SuggestionsData = {
        show: false,
        selectedText: '',
        originalText: '',
        suggestions: [],
        isLoading: false,
        isPlaceholder: false,
        fullPrompt: '',
      };

      act(() => {
        result.current.setSuggestionsData(suggestions);
        result.current.setSuggestionsData(null);
      });

      expect(result.current.suggestionsData).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('stores and updates session values', () => {
      const { result } = renderHook(() => usePromptSessionState());

      act(() => {
        result.current.setConceptElements({ concept: 'test' });
        result.current.setCurrentPromptUuid('uuid-1');
        result.current.setCurrentPromptDocId('doc-1');
        result.current.setActiveVersionId('v-1');
      });

      expect(result.current.conceptElements).toEqual({ concept: 'test' });
      expect(result.current.currentPromptUuid).toBe('uuid-1');
      expect(result.current.currentPromptDocId).toBe('doc-1');
      expect(result.current.activeVersionId).toBe('v-1');
    });
  });
});
