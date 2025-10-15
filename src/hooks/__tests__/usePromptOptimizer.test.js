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
});
