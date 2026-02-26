import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePromptOptimizer } from '@hooks/usePromptOptimizer';

const {
  useToast,
  usePromptOptimizerApi,
  usePromptOptimizerState,
  runTwoStageOptimization,
  runSingleStageOptimization,
  markOptimizationStart,
  logDebug,
  logInfo,
  logWarn,
  logError,
  startTimer,
  endTimer,
} = vi.hoisted(() => ({
  useToast: vi.fn(),
  usePromptOptimizerApi: vi.fn(),
  usePromptOptimizerState: vi.fn(),
  runTwoStageOptimization: vi.fn(),
  runSingleStageOptimization: vi.fn(),
  markOptimizationStart: vi.fn(),
  logDebug: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(() => 12),
}));

vi.mock('@components/Toast', () => ({
  useToast,
}));

vi.mock('@hooks/usePromptOptimizerApi', () => ({
  usePromptOptimizerApi,
}));

vi.mock('@hooks/usePromptOptimizerState', () => ({
  usePromptOptimizerState,
}));

vi.mock('@hooks/utils/promptOptimizationFlow', () => ({
  runTwoStageOptimization,
  runSingleStageOptimization,
}));

vi.mock('@hooks/utils/performanceMetrics', () => ({
  markOptimizationStart,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: vi.fn(() => ({
      debug: logDebug,
      info: logInfo,
      warn: logWarn,
      error: logError,
    })),
    startTimer,
    endTimer,
  },
}));

function createStateHookResult() {
  const state = {
    inputPrompt: 'state prompt',
    isProcessing: false,
    optimizedPrompt: '',
    displayedPrompt: '',
    genericOptimizedPrompt: null,
    previewPrompt: null,
    previewAspectRatio: null,
    qualityScore: null,
    skipAnimation: false,
    improvementContext: { stateContext: true },
    draftPrompt: '',
    isDraftReady: false,
    isRefining: false,
    draftSpans: null,
    refinedSpans: null,
    lockedSpans: [
      {
        id: 'locked-1',
        text: 'subject',
        start: 0,
        end: 7,
        category: 'subject.identity',
      },
    ],
  };

  return {
    state,
    setInputPrompt: vi.fn(),
    setOptimizedPrompt: vi.fn(),
    setDisplayedPrompt: vi.fn(),
    setGenericOptimizedPrompt: vi.fn(),
    setQualityScore: vi.fn(),
    setPreviewPrompt: vi.fn(),
    setPreviewAspectRatio: vi.fn(),
    setSkipAnimation: vi.fn(),
    setImprovementContext: vi.fn(),
    setDraftPrompt: vi.fn(),
    setIsDraftReady: vi.fn(),
    setIsRefining: vi.fn(),
    setDraftSpans: vi.fn(),
    setRefinedSpans: vi.fn(),
    setLockedSpans: vi.fn(),
    addLockedSpan: vi.fn(),
    removeLockedSpan: vi.fn(),
    clearLockedSpans: vi.fn(),
    snapshotForRollback: vi.fn(),
    rollback: vi.fn(),
    startOptimization: vi.fn(),
    resetPrompt: vi.fn(),
    finishProcessing: vi.fn(),
    setIsProcessing: vi.fn(),
  };
}

function createApiHookResult() {
  return {
    analyzeAndOptimize: vi.fn(),
    optimizeWithFallback: vi.fn(),
    compilePrompt: vi.fn(),
    calculateQualityScore: vi.fn(() => 87),
  };
}

describe('usePromptOptimizer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useToast.mockReturnValue({
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    });
    usePromptOptimizerState.mockReturnValue(createStateHookResult());
    usePromptOptimizerApi.mockReturnValue(createApiHookResult());
    runTwoStageOptimization.mockResolvedValue({ optimized: 'two-stage output', score: 91 });
    runSingleStageOptimization.mockResolvedValue({ optimized: 'single-stage output', score: 79 });
  });

  it('routes non-image requests to two-stage flow and forwards generation options', async () => {
    const { result } = renderHook(() => usePromptOptimizer('video', 'sora-2', true));
    const outcome = await act(async () =>
      result.current.optimize(
        'input prompt',
        { uiContext: 'A' },
        { brainstorm: 'B' },
        undefined,
        {
          skipCache: true,
          generationParams: { quality: 'high' } as never,
        }
      )
    );

    expect(runTwoStageOptimization).toHaveBeenCalledTimes(1);
    expect(runSingleStageOptimization).not.toHaveBeenCalled();
    expect(runTwoStageOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        promptToOptimize: 'input prompt',
        selectedMode: 'video',
        selectedModel: 'sora-2',
        context: { uiContext: 'A' },
        brainstormContext: { brainstorm: 'B' },
        generationParams: { quality: 'high' },
        skipCache: true,
      })
    );
    expect(markOptimizationStart).toHaveBeenCalledTimes(1);
    expect(outcome).toEqual({ optimized: 'two-stage output', score: 91 });
  });

  it('bypasses two-stage and uses single-stage flow when startImage is provided', async () => {
    const { result } = renderHook(() => usePromptOptimizer('video', 'sora-2', true));

    await act(async () => {
      await result.current.optimize('input prompt', null, null, undefined, {
        startImage: 'https://example.com/start.png',
        sourcePrompt: 'source prompt',
        constraintMode: 'transform',
      });
    });

    expect(runTwoStageOptimization).not.toHaveBeenCalled();
    expect(runSingleStageOptimization).toHaveBeenCalledTimes(1);
    expect(runSingleStageOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        promptToOptimize: 'input prompt',
        selectedMode: 'video',
        selectedModel: 'sora-2',
        startImage: 'https://example.com/start.png',
        sourcePrompt: 'source prompt',
        constraintMode: 'transform',
      })
    );
  });

  it('uses targetModel override when provided', async () => {
    const { result } = renderHook(() => usePromptOptimizer('video', 'sora-2', false));

    await act(async () => {
      await result.current.optimize('input prompt', null, null, 'kling-26');
    });

    expect(runSingleStageOptimization).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedModel: 'kling-26',
      })
    );
    expect(runTwoStageOptimization).not.toHaveBeenCalled();
  });

  it('returns null and warns when prompt is empty', async () => {
    const toast = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };
    useToast.mockReturnValueOnce(toast);
    const { result } = renderHook(() => usePromptOptimizer('video', 'sora-2', true));

    let response = null;
    await act(async () => {
      response = await result.current.optimize('   ');
    });

    expect(response).toBeNull();
    expect(toast.warning).toHaveBeenCalledWith('Please enter a prompt');
    expect(runTwoStageOptimization).not.toHaveBeenCalled();
    expect(runSingleStageOptimization).not.toHaveBeenCalled();
  });
});
