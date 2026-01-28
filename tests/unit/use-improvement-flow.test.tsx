import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useImprovementFlow } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useImprovementFlow';
import type { Toast } from '@hooks/types';

const createToast = (): Toast => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

describe('useImprovementFlow', () => {
  it('warns when improving without an input prompt', () => {
    const promptOptimizer = {
      inputPrompt: '   ',
      setInputPrompt: vi.fn(),
      setImprovementContext: vi.fn(),
    };

    const toast = createToast();
    const setShowImprover: MockedFunction<(show: boolean) => void> = vi.fn();
    const handleOptimize: MockedFunction<(prompt: string, context: unknown) => void> = vi.fn();

    const { result } = renderHook(() =>
      useImprovementFlow({
        promptOptimizer,
        toast,
        setShowImprover,
        handleOptimize,
      })
    );

    act(() => {
      result.current.handleImproveFirst();
    });

    expect(toast.warning).toHaveBeenCalledWith('Please enter a prompt first');
    expect(setShowImprover).not.toHaveBeenCalled();
  });

  it('shows the improver and triggers optimization on completion', async () => {
    const promptOptimizer = {
      inputPrompt: 'Original prompt',
      setInputPrompt: vi.fn(),
      setImprovementContext: vi.fn(),
    };

    const toast = createToast();
    const setShowImprover: MockedFunction<(show: boolean) => void> = vi.fn();
    const handleOptimize: MockedFunction<(prompt: string, context: unknown) => void> = vi.fn();

    const { result } = renderHook(() =>
      useImprovementFlow({
        promptOptimizer,
        toast,
        setShowImprover,
        handleOptimize,
      })
    );

    act(() => {
      result.current.handleImproveFirst();
    });

    expect(setShowImprover).toHaveBeenCalledWith(true);

    await act(async () => {
      await result.current.handleImprovementComplete('Enhanced prompt', { tone: 'warm' });
    });

    expect(setShowImprover).toHaveBeenCalledWith(false);
    expect(promptOptimizer.setImprovementContext).toHaveBeenCalledWith({ tone: 'warm' });
    expect(promptOptimizer.setInputPrompt).toHaveBeenCalledWith('Enhanced prompt');
    expect(handleOptimize).toHaveBeenCalledWith('Enhanced prompt', { tone: 'warm' });
  });
});
