import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import { usePromptOptimizerState } from '@hooks/usePromptOptimizerState';

describe('usePromptOptimizerState', () => {
  describe('error and edge cases', () => {
    it('ADD_LOCKED_SPAN with duplicate id does not add a second entry', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.addLockedSpan({ id: 'span-1', text: 'first', start: 0, end: 5, category: 'subject' });
      });
      act(() => {
        result.current.addLockedSpan({ id: 'span-1', text: 'duplicate', start: 0, end: 9, category: 'action' });
      });

      expect(result.current.state.lockedSpans).toHaveLength(1);
      expect(result.current.state.lockedSpans[0].text).toBe('first');
    });

    it('REMOVE_LOCKED_SPAN with non-existent id leaves state unchanged', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.addLockedSpan({ id: 'span-1', text: 'keep', start: 0, end: 4, category: 'subject' });
      });
      act(() => {
        result.current.removeLockedSpan('non-existent');
      });

      expect(result.current.state.lockedSpans).toHaveLength(1);
    });

    it('CLEAR_LOCKED_SPANS empties locked spans even when populated', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.addLockedSpan({ id: 'a', text: 'x', start: 0, end: 1, category: 'subject' });
        result.current.addLockedSpan({ id: 'b', text: 'y', start: 2, end: 3, category: 'action' });
      });
      act(() => {
        result.current.clearLockedSpans();
      });

      expect(result.current.state.lockedSpans).toHaveLength(0);
    });

    it('setIsProcessing(false) also sets isRefining to false', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.setIsRefining(true);
      });
      expect(result.current.state.isRefining).toBe(true);

      act(() => {
        result.current.setIsProcessing(false);
      });
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.isRefining).toBe(false);
    });
  });

  describe('START_OPTIMIZATION resets output state but preserves lockedSpans', () => {
    it('clears optimizedPrompt, displayedPrompt, qualityScore, and draft state', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.setOptimizedPrompt('some optimized prompt');
        result.current.setDisplayedPrompt('displayed');
        result.current.setQualityScore(85);
        result.current.setDraftPrompt('draft');
        result.current.setIsDraftReady(true);
        result.current.addLockedSpan({ id: 'lock-1', text: 'locked', start: 0, end: 6, category: 'subject' });
      });

      act(() => {
        result.current.startOptimization();
      });

      expect(result.current.state.optimizedPrompt).toBe('');
      expect(result.current.state.displayedPrompt).toBe('');
      expect(result.current.state.qualityScore).toBeNull();
      expect(result.current.state.draftPrompt).toBe('');
      expect(result.current.state.isDraftReady).toBe(false);
      expect(result.current.state.isProcessing).toBe(true);
      // lockedSpans preserved
      expect(result.current.state.lockedSpans).toHaveLength(1);
      expect(result.current.state.lockedSpans[0].id).toBe('lock-1');
    });
  });

  describe('RESET returns to initial state', () => {
    it('resets all fields including lockedSpans', () => {
      const { result } = renderHook(() => usePromptOptimizerState());

      act(() => {
        result.current.setInputPrompt('test input');
        result.current.setOptimizedPrompt('optimized');
        result.current.addLockedSpan({ id: 'x', text: 'x', start: 0, end: 1, category: 'subject' });
      });

      act(() => {
        result.current.resetPrompt();
      });

      expect(result.current.state.inputPrompt).toBe('');
      expect(result.current.state.optimizedPrompt).toBe('');
      expect(result.current.state.lockedSpans).toHaveLength(0);
      expect(result.current.state.isProcessing).toBe(false);
      expect(result.current.state.qualityScore).toBeNull();
    });
  });

  describe('core state setters', () => {
    it('setInputPrompt updates inputPrompt', () => {
      const { result } = renderHook(() => usePromptOptimizerState());
      act(() => { result.current.setInputPrompt('new prompt'); });
      expect(result.current.state.inputPrompt).toBe('new prompt');
    });

    it('setPreviewPrompt and setPreviewAspectRatio update their fields', () => {
      const { result } = renderHook(() => usePromptOptimizerState());
      act(() => {
        result.current.setPreviewPrompt('preview text');
        result.current.setPreviewAspectRatio('16:9');
      });
      expect(result.current.state.previewPrompt).toBe('preview text');
      expect(result.current.state.previewAspectRatio).toBe('16:9');
    });

    it('setSkipAnimation toggles skipAnimation', () => {
      const { result } = renderHook(() => usePromptOptimizerState());
      act(() => { result.current.setSkipAnimation(true); });
      expect(result.current.state.skipAnimation).toBe(true);
    });

    it('setImprovementContext stores arbitrary context', () => {
      const { result } = renderHook(() => usePromptOptimizerState());
      const ctx = { suggestions: ['improve lighting'] };
      act(() => { result.current.setImprovementContext(ctx); });
      expect(result.current.state.improvementContext).toEqual(ctx);
    });
  });
});
