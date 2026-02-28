import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContinuityShot } from '@/features/continuity/types';
import { useEditorShotPromptBinding } from '../useEditorShotPromptBinding';

const buildShot = (userPrompt: string): ContinuityShot =>
  ({
    id: 'shot-1',
    sessionId: 'session-1',
    sequenceIndex: 0,
    userPrompt,
    continuityMode: 'frame-bridge',
    styleStrength: 0.6,
    styleReferenceId: null,
    modelId: 'model-1',
    status: 'draft',
    createdAt: '2026-02-28T00:00:00.000Z',
  }) as ContinuityShot;

describe('regression: continuity-shot hydration must preserve loaded output when input already matches', () => {
  it('does not clear displayed output on first shot sync when input prompt already equals shot prompt', () => {
    const setInputPrompt = vi.fn();
    const setDisplayedPromptSilently = vi.fn();
    const setShowResults = vi.fn();

    renderHook(() =>
      useEditorShotPromptBinding({
        currentEditorShot: buildShot('raw input prompt'),
        hasActiveContinuityShot: true,
        promptOptimizer: {
          inputPrompt: 'raw input prompt',
          displayedPrompt: 'optimized output that should stay visible',
          setInputPrompt,
        },
        updateShot: vi.fn(async () => buildShot('raw input prompt')),
        setDisplayedPromptSilently,
        setShowResults,
      })
    );

    expect(setInputPrompt).not.toHaveBeenCalled();
    expect(setDisplayedPromptSilently).not.toHaveBeenCalled();
    expect(setShowResults).not.toHaveBeenCalled();
  });
});
