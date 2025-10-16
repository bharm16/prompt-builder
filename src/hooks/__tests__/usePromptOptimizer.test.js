import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePromptOptimizer } from '../usePromptOptimizer';

// Use the global fetch mock from setup

// Mock Toast to capture calls
vi.mock('../../components/Toast.jsx', () => {
  const warning = vi.fn();
  const success = vi.fn();
  const info = vi.fn();
  const error = vi.fn();
  return {
    useToast: () => ({ warning, success, info, error }),
    ToastProvider: ({ children }) => children,
    __mocks: { warning, success, info, error },
  };
});

describe('usePromptOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => usePromptOptimizer());
    expect(result.current.inputPrompt).toBe('');
    expect(result.current.isProcessing).toBe(false);
  });

  it('shows warning and returns null when optimizing empty prompt', async () => {
    const { result } = renderHook(() => usePromptOptimizer('code'));
    // ensure prompt empty
    await act(async () => {
      const res = await result.current.optimize('');
      expect(res).toBeNull();
    });
  });

  it('optimizes successfully and sets quality score', async () => {
    // Mock fetch to return optimized prompt
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ optimizedPrompt: 'Optimized: Goal...\n\nContext...\nReturn Format...' }),
    });

    const { result } = renderHook(() => usePromptOptimizer('code'));
    await act(async () => {
      result.current.setInputPrompt('short');
      const out = await result.current.optimize('short');
      expect(out).not.toBeNull();
    });

    expect(result.current.optimizedPrompt).toMatch(/Optimized:/);
    expect(result.current.qualityScore).toBeGreaterThan(0);
  });

  it('handles API error and shows toast.error', async () => {
    // mock error response
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'API request failed' }),
    });

    const { result } = renderHook(() => usePromptOptimizer('code'));
    let out;
    await act(async () => {
      result.current.setInputPrompt('will-fail');
      out = await result.current.optimize('will-fail');
    });
    expect(out).toBeNull();
  });

  it('calculateQualityScore reflects sections and length', () => {
    const { result } = renderHook(() => usePromptOptimizer('code'));
    const input = 'short prompt';
    const low = result.current.calculateQualityScore(input, 'basic output');
    const high = result.current.calculateQualityScore(
      input,
      '**Goal**\nSomething\n\n**Return Format**\nJSON\n\n**Context** extra details here that increase length and detail'
    );
    expect(high).toBeGreaterThan(low);
  });

  it('resetPrompt clears state', () => {
    const { result } = renderHook(() => usePromptOptimizer('code'));
    act(() => {
      result.current.setInputPrompt('abc');
      result.current.setOptimizedPrompt('xyz');
      result.current.setDisplayedPrompt('xyz');
      result.current.setSkipAnimation(true);
      result.current.setImprovementContext({ foo: 'bar' });
    });
    act(() => {
      result.current.resetPrompt();
    });
    expect(result.current.inputPrompt).toBe('');
    expect(result.current.optimizedPrompt).toBe('');
    expect(result.current.displayedPrompt).toBe('');
    expect(result.current.qualityScore).toBe(null);
    expect(result.current.skipAnimation).toBe(false);
    expect(result.current.improvementContext).toBe(null);
  });
});
