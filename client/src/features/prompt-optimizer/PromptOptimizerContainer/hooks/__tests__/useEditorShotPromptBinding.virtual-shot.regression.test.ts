import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ContinuityShot } from '@/features/continuity/types';
import { useEditorShotPromptBinding } from '../useEditorShotPromptBinding';

const buildVirtualShot = (): ContinuityShot =>
  ({
    id: '__single__',
    sessionId: 'session_123',
    sequenceIndex: 0,
    userPrompt: 'raw prompt from virtual shot',
    continuityMode: 'none',
    styleStrength: 0.6,
    styleReferenceId: null,
    modelId: 'sora',
    status: 'draft',
    createdAt: '2026-02-28T00:00:00.000Z',
  }) as ContinuityShot;

describe('regression: virtual shot must not clobber loaded prompt output', () => {
  it('does not clear displayed output when no active continuity shot exists', () => {
    const setInputPrompt = vi.fn();
    const setDisplayedPromptSilently = vi.fn();
    const setShowResults = vi.fn();

    renderHook(() =>
      useEditorShotPromptBinding({
        currentEditorShot: buildVirtualShot(),
        hasActiveContinuityShot: false,
        promptOptimizer: {
          inputPrompt: 'optimized prompt already loaded',
          displayedPrompt: 'optimized prompt already loaded',
          setInputPrompt,
        },
        updateShot: vi.fn(async () => buildVirtualShot()),
        setDisplayedPromptSilently,
        setShowResults,
      })
    );

    expect(setInputPrompt).not.toHaveBeenCalled();
    expect(setDisplayedPromptSilently).not.toHaveBeenCalled();
    expect(setShowResults).not.toHaveBeenCalled();
  });
});
