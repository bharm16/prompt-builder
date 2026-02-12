import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ContinuityShot } from '@/features/continuity/types';
import { useSequenceShotPromptSync } from '../hooks/useSequenceShotPromptSync';

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

describe('PromptOptimizerWorkspace sequence prompt sync', () => {
  it('syncs prompt for populated and blank shots while preserving round-trip switching', async () => {
    const setDisplayedPromptSilently = vi.fn();
    const setShowResults = vi.fn();
    const setInputPromptSpy = vi.fn();

    const state: {
      isSequenceMode: boolean;
      currentShot: ContinuityShot | null;
      inputPrompt: string;
      displayedPrompt: string;
    } = {
      isSequenceMode: true,
      currentShot: buildShot({ id: 'shot-1', userPrompt: 'Shot one prompt' }),
      inputPrompt: '',
      displayedPrompt: 'Optimized text',
    };

    const { rerender } = renderHook(() =>
      useSequenceShotPromptSync({
        isSequenceMode: state.isSequenceMode,
        currentShot: state.currentShot,
        promptOptimizer: {
          inputPrompt: state.inputPrompt,
          displayedPrompt: state.displayedPrompt,
          setInputPrompt: (nextPrompt: string) => {
            state.inputPrompt = nextPrompt;
            setInputPromptSpy(nextPrompt);
          },
        },
        setDisplayedPromptSilently,
        setShowResults,
      })
    );

    await waitFor(() => {
      expect(setInputPromptSpy).toHaveBeenLastCalledWith('Shot one prompt');
    });

    state.inputPrompt = 'Shot one prompt (editing)';
    state.displayedPrompt = '';
    rerender();

    expect(setInputPromptSpy).toHaveBeenCalledTimes(1);

    state.currentShot = buildShot({ id: 'shot-2', sequenceIndex: 1, userPrompt: '' });
    state.displayedPrompt = 'Optimized text';
    rerender();

    await waitFor(() => {
      expect(setInputPromptSpy).toHaveBeenLastCalledWith('');
    });
    expect(setDisplayedPromptSilently).toHaveBeenCalledWith('');
    expect(setShowResults).toHaveBeenCalledWith(false);

    state.currentShot = buildShot({ id: 'shot-1', userPrompt: 'Shot one prompt' });
    state.displayedPrompt = 'Optimized text';
    rerender();

    await waitFor(() => {
      expect(setInputPromptSpy).toHaveBeenLastCalledWith('Shot one prompt');
    });
  });
});
