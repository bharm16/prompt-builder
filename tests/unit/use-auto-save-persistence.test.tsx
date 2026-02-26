import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoSave } from '@/features/prompt-optimizer/PromptOptimizerContainer/hooks/useAutoSave';

describe('useAutoSave persistence consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createOptions(overrides: Record<string, unknown> = {}) {
    return {
      currentPromptUuid: 'uuid-1',
      currentPromptDocId: 'doc-1',
      displayedPrompt: 'initial text',
      isApplyingHistoryRef: { current: false },
      handleDisplayedPromptChange: vi.fn(),
      updateEntryOutput: vi.fn().mockResolvedValue(undefined) as (uuid: string, docId: string | null, output: string) => Promise<void>,
      setOutputSaveState: vi.fn(),
      setOutputLastSavedAt: vi.fn(),
      ...overrides,
    };
  }

  it('does not advance dedup ref when persistence fails — next edit retries', async () => {
    const updateEntryOutput = vi.fn()
      .mockRejectedValueOnce(new Error('Firestore unavailable'))
      .mockResolvedValueOnce(undefined) as (uuid: string, docId: string | null, output: string) => Promise<void>;

    const setOutputSaveState = vi.fn();
    const options = createOptions({ updateEntryOutput, setOutputSaveState });
    const { result } = renderHook(() => useAutoSave(options));

    // First edit triggers save attempt
    act(() => {
      result.current.handleDisplayedPromptChangeWithAutosave('edited text');
    });

    // Advance past debounce
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    // Let the async IIFE settle
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Persistence failed — error state set
    expect(setOutputSaveState).toHaveBeenCalledWith('error');
    expect(updateEntryOutput).toHaveBeenCalledTimes(1);

    // Second edit with same text should RETRY (dedup ref was NOT advanced)
    setOutputSaveState.mockClear();
    act(() => {
      result.current.handleDisplayedPromptChangeWithAutosave('edited text');
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Second attempt should have been made
    expect(updateEntryOutput).toHaveBeenCalledTimes(2);
    expect(setOutputSaveState).toHaveBeenCalledWith('saved');
  });

  it('marks saved only after persistence resolves, not before', async () => {
    let resolvePromise: () => void;
    const pendingPromise = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    const updateEntryOutput = vi.fn()
      .mockReturnValue(pendingPromise) as (uuid: string, docId: string | null, output: string) => Promise<void>;

    const setOutputSaveState = vi.fn();
    const options = createOptions({ updateEntryOutput, setOutputSaveState });
    const { result } = renderHook(() => useAutoSave(options));

    act(() => {
      result.current.handleDisplayedPromptChangeWithAutosave('new text');
    });

    // Advance past debounce — async save starts
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // 'saving' was set synchronously, but 'saved' should NOT be set yet
    const calls = setOutputSaveState.mock.calls.map((c: unknown[]) => c[0]);
    expect(calls).toContain('saving');
    expect(calls).not.toContain('saved');

    // Now resolve the persistence promise
    await act(async () => {
      resolvePromise!();
      await vi.runAllTimersAsync();
    });

    const allCalls = setOutputSaveState.mock.calls.map((c: unknown[]) => c[0]);
    expect(allCalls).toContain('saved');
  });
});
