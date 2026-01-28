import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePromptStatus } from '@features/prompt-optimizer/PromptCanvas/hooks/usePromptStatus';

describe('usePromptStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks generated when no displayed prompt', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: null,
        inputPrompt: 'input',
        isDraftReady: false,
        isRefining: false,
        isProcessing: false,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({
      promptState: 'generated',
      generatedTimestamp: null,
    });
  });

  it('marks synced when displayed prompt matches input', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'same',
        inputPrompt: 'same',
        isDraftReady: false,
        isRefining: false,
        isProcessing: false,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ promptState: 'synced' });
  });

  it('marks generated and sets timestamp when draft ready and idle', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'output',
        inputPrompt: 'input',
        isDraftReady: true,
        isRefining: false,
        isProcessing: false,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({
      promptState: 'generated',
      generatedTimestamp: new Date('2024-01-01T00:00:00Z').getTime(),
    });
  });

  it('keeps existing generated timestamp when already set', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'output',
        inputPrompt: 'input',
        isDraftReady: true,
        isRefining: false,
        isProcessing: false,
        generatedTimestamp: 123,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ promptState: 'generated' });
  });

  it('marks edited when refining or processing', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'output',
        inputPrompt: 'input',
        isDraftReady: true,
        isRefining: true,
        isProcessing: false,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ promptState: 'edited' });
  });
});
