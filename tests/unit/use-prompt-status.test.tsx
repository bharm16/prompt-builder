import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePromptStatus } from '@features/prompt-optimizer/PromptCanvas/hooks/usePromptStatus';

describe('usePromptStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks generated when no displayed prompt exists', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: null,
        inputPrompt: 'input',
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
        isProcessing: false,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ promptState: 'synced' });
  });

  it('marks generated and sets a timestamp when a final optimized prompt is present', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'output',
        inputPrompt: 'input',
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

  it('marks edited while processing', () => {
    const setState = vi.fn();

    renderHook(() =>
      usePromptStatus({
        displayedPrompt: 'output',
        inputPrompt: 'input',
        isProcessing: true,
        generatedTimestamp: null,
        setState,
      })
    );

    expect(setState).toHaveBeenCalledWith({ promptState: 'edited' });
  });
});
