import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ContinuityShot } from '@/features/continuity/types';
import { useEditorShotPromptBinding } from '../hooks/useEditorShotPromptBinding';

const buildShot = (overrides: Partial<ContinuityShot>): ContinuityShot => ({
  id: 'shot-1',
  sessionId: 'session-1',
  sequenceIndex: 0,
  userPrompt: 'Shot prompt',
  continuityMode: 'frame-bridge',
  styleStrength: 0.6,
  styleReferenceId: null,
  modelId: 'model-1',
  status: 'draft',
  createdAt: '2026-02-12T00:00:00.000Z',
  ...overrides,
});

describe('PromptOptimizerWorkspace editor shot prompt binding', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('syncs prompt from the selected editor shot and clears results output', async () => {
    vi.useRealTimers();
    const setInputPromptSpy = vi.fn();
    const setDisplayedPromptSilently = vi.fn();
    const setShowResults = vi.fn();

    const state: {
      currentEditorShot: ContinuityShot | null;
      hasActiveContinuityShot: boolean;
      inputPrompt: string;
      displayedPrompt: string;
    } = {
      currentEditorShot: buildShot({ id: 'shot-1', userPrompt: 'Shot one prompt' }),
      hasActiveContinuityShot: true,
      inputPrompt: '',
      displayedPrompt: 'Existing optimized output',
    };

    renderHook(() =>
      useEditorShotPromptBinding({
        currentEditorShot: state.currentEditorShot,
        hasActiveContinuityShot: state.hasActiveContinuityShot,
        promptOptimizer: {
          inputPrompt: state.inputPrompt,
          displayedPrompt: state.displayedPrompt,
          setInputPrompt: (nextPrompt: string) => {
            state.inputPrompt = nextPrompt;
            setInputPromptSpy(nextPrompt);
          },
        },
        updateShot: vi.fn(async () => state.currentEditorShot as ContinuityShot),
        setDisplayedPromptSilently,
        setShowResults,
      })
    );

    await waitFor(() => {
      expect(setInputPromptSpy).toHaveBeenLastCalledWith('Shot one prompt');
    });
    expect(setDisplayedPromptSilently).toHaveBeenCalledWith('');
    expect(setShowResults).toHaveBeenCalledWith(false);
  });

  it('debounces continuity shot prompt persistence while editing', async () => {
    const updateShot = vi.fn(async () => buildShot({ id: 'shot-1', userPrompt: 'Updated prompt' }));

    const state: {
      currentEditorShot: ContinuityShot | null;
      hasActiveContinuityShot: boolean;
      inputPrompt: string;
      displayedPrompt: string;
    } = {
      currentEditorShot: buildShot({ id: 'shot-1', userPrompt: 'Shot one prompt' }),
      hasActiveContinuityShot: true,
      inputPrompt: 'Shot one prompt',
      displayedPrompt: '',
    };

    const { rerender } = renderHook(() =>
      useEditorShotPromptBinding({
        currentEditorShot: state.currentEditorShot,
        hasActiveContinuityShot: state.hasActiveContinuityShot,
        promptOptimizer: {
          inputPrompt: state.inputPrompt,
          displayedPrompt: state.displayedPrompt,
          setInputPrompt: (nextPrompt: string) => {
            state.inputPrompt = nextPrompt;
          },
        },
        updateShot,
        setDisplayedPromptSilently: vi.fn(),
        setShowResults: vi.fn(),
      })
    );

    state.inputPrompt = 'Shot one prompt (edited)';
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(499);
    });
    expect(updateShot).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(updateShot).toHaveBeenCalledWith('shot-1', { prompt: 'Shot one prompt (edited)' });
  });

  it('skips persistence when there is no active continuity shot', async () => {
    const updateShot = vi.fn(async () => buildShot({ id: 'shot-1' }));

    const state: {
      currentEditorShot: ContinuityShot | null;
      hasActiveContinuityShot: boolean;
      inputPrompt: string;
      displayedPrompt: string;
    } = {
      currentEditorShot: buildShot({ id: '__single__', userPrompt: 'Single prompt' }),
      hasActiveContinuityShot: false,
      inputPrompt: 'Single prompt',
      displayedPrompt: '',
    };

    const { rerender } = renderHook(() =>
      useEditorShotPromptBinding({
        currentEditorShot: state.currentEditorShot,
        hasActiveContinuityShot: state.hasActiveContinuityShot,
        promptOptimizer: {
          inputPrompt: state.inputPrompt,
          displayedPrompt: state.displayedPrompt,
          setInputPrompt: (nextPrompt: string) => {
            state.inputPrompt = nextPrompt;
          },
        },
        updateShot,
        setDisplayedPromptSilently: vi.fn(),
        setShowResults: vi.fn(),
      })
    );

    state.inputPrompt = 'Single prompt update';
    rerender();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(updateShot).not.toHaveBeenCalled();
  });
});
