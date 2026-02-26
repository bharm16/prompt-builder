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
import type { SpansData } from '@hooks/usePromptOptimizerState';

const MOCK_SPANS: SpansData = {
  spans: [{ start: 0, end: 5, category: 'subject', confidence: 0.9 }],
  meta: null,
  source: 'draft',
  timestamp: 1000,
};

describe('SNAPSHOT_FOR_ROLLBACK / ROLLBACK', () => {
  it('ROLLBACK restores the pre-optimization snapshot after stream error', () => {
    const { result } = renderHook(() => usePromptOptimizerState());

    // Set up pre-optimization state
    act(() => {
      result.current.setOptimizedPrompt('original optimized');
      result.current.setDisplayedPrompt('original displayed');
      result.current.setQualityScore(85);
      result.current.setPreviewPrompt('preview text');
      result.current.setDraftSpans(MOCK_SPANS);
    });

    // Snapshot before optimization
    act(() => {
      result.current.snapshotForRollback();
    });

    // START_OPTIMIZATION wipes state
    act(() => {
      result.current.startOptimization();
    });
    expect(result.current.state.optimizedPrompt).toBe('');
    expect(result.current.state.displayedPrompt).toBe('');
    expect(result.current.state.qualityScore).toBeNull();

    // Partial draft arrives from stream
    act(() => {
      result.current.setDraftPrompt('partial draft from broken stream');
    });

    // Stream error triggers rollback
    act(() => {
      result.current.rollback();
    });

    // State restored to pre-optimization values
    expect(result.current.state.optimizedPrompt).toBe('original optimized');
    expect(result.current.state.displayedPrompt).toBe('original displayed');
    expect(result.current.state.qualityScore).toBe(85);
    expect(result.current.state.previewPrompt).toBe('preview text');
    expect(result.current.state.draftSpans).toEqual(MOCK_SPANS);
    expect(result.current.state.draftPrompt).toBe('');
    expect(result.current.state.isProcessing).toBe(false);
    expect(result.current.state.isRefining).toBe(false);
    expect(result.current.state.isDraftReady).toBe(false);
    // Snapshot is consumed
    expect(result.current.state.rollbackSnapshot).toBeNull();
  });

  it('ROLLBACK without snapshot clears processing flags only', () => {
    const { result } = renderHook(() => usePromptOptimizerState());

    act(() => {
      result.current.setOptimizedPrompt('some prompt');
      result.current.setIsRefining(true);
    });

    // Rollback without prior snapshot
    act(() => {
      result.current.rollback();
    });

    // Processing flags cleared
    expect(result.current.state.isProcessing).toBe(false);
    expect(result.current.state.isRefining).toBe(false);
    expect(result.current.state.isDraftReady).toBe(false);
    // Existing state unchanged (not wiped)
    expect(result.current.state.optimizedPrompt).toBe('some prompt');
  });

  it('RESET clears rollbackSnapshot', () => {
    const { result } = renderHook(() => usePromptOptimizerState());

    act(() => {
      result.current.setOptimizedPrompt('saved');
      result.current.snapshotForRollback();
    });
    expect(result.current.state.rollbackSnapshot).not.toBeNull();

    act(() => {
      result.current.resetPrompt();
    });
    expect(result.current.state.rollbackSnapshot).toBeNull();
  });

  it('snapshot captures state at the moment it is taken, not later mutations', () => {
    const { result } = renderHook(() => usePromptOptimizerState());

    act(() => {
      result.current.setOptimizedPrompt('before snapshot');
    });
    act(() => {
      result.current.snapshotForRollback();
    });
    act(() => {
      result.current.setOptimizedPrompt('after snapshot');
    });

    act(() => {
      result.current.rollback();
    });
    expect(result.current.state.optimizedPrompt).toBe('before snapshot');
  });
});
