import { describe, expect, it, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useConceptBrainstorm } from '@features/prompt-optimizer/PromptOptimizerContainer/hooks/useConceptBrainstorm';
import type { CapabilityValues } from '@shared/capabilities';
import type { Toast } from '@hooks/types';

const logSpies = {
  error: vi.fn(),
};

class PromptContextMock {
  elements: Record<string, unknown>;
  metadata: Record<string, unknown>;

  constructor(elements: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) {
    this.elements = elements;
    this.metadata = metadata;
  }

  toJSON(): { elements: Record<string, unknown>; metadata: Record<string, unknown> } {
    return { elements: this.elements, metadata: this.metadata };
  }
}

vi.mock('@utils/PromptContext', () => ({
  PromptContext: PromptContextMock,
}));

vi.mock('@/services/LoggingService', () => ({
  logger: {
    child: () => logSpies,
  },
}));

vi.mock('@config/performance.config', () => ({
  PERFORMANCE_CONFIG: {
    ASYNC_OPERATION_DELAY_MS: 0,
  },
  default: {
    ASYNC_OPERATION_DELAY_MS: 0,
  },
}));

type UseConceptBrainstormParams = Parameters<typeof useConceptBrainstorm>[0];

type PromptOptimizer = UseConceptBrainstormParams['promptOptimizer'];
type PromptHistory = UseConceptBrainstormParams['promptHistory'];

type ApplyInitialHighlightSnapshot = UseConceptBrainstormParams['applyInitialHighlightSnapshot'];
type ResetEditStacks = UseConceptBrainstormParams['resetEditStacks'];

type SetConceptElements = UseConceptBrainstormParams['setConceptElements'];
type SetPromptContext = UseConceptBrainstormParams['setPromptContext'];
type SetShowBrainstorm = UseConceptBrainstormParams['setShowBrainstorm'];
type SetCurrentPromptUuid = UseConceptBrainstormParams['setCurrentPromptUuid'];
type SetCurrentPromptDocId = UseConceptBrainstormParams['setCurrentPromptDocId'];
type SetDisplayedPromptSilently = UseConceptBrainstormParams['setDisplayedPromptSilently'];
type SetShowResults = UseConceptBrainstormParams['setShowResults'];
type Navigate = UseConceptBrainstormParams['navigate'];

type OptimizeResult = Awaited<ReturnType<PromptOptimizer['optimize']>>;

const createPromptOptimizer = (overrides: Partial<PromptOptimizer> = {}): PromptOptimizer => {
  const setInputPrompt: MockedFunction<PromptOptimizer['setInputPrompt']> = vi.fn();
  const optimize: MockedFunction<PromptOptimizer['optimize']> = vi.fn();

  return {
    setInputPrompt,
    optimize,
    ...overrides,
  };
};

const createPromptHistory = (overrides: Partial<PromptHistory> = {}): PromptHistory => {
  const saveToHistory: MockedFunction<PromptHistory['saveToHistory']> = vi.fn();
  return {
    saveToHistory,
    ...overrides,
  };
};

const createToast = (): Toast => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

const createDefaults = (overrides: Partial<UseConceptBrainstormParams> = {}): UseConceptBrainstormParams => {
  const setConceptElements: MockedFunction<SetConceptElements> = vi.fn();
  const setPromptContext: MockedFunction<SetPromptContext> = vi.fn();
  const setShowBrainstorm: MockedFunction<SetShowBrainstorm> = vi.fn();
  const setCurrentPromptUuid: MockedFunction<SetCurrentPromptUuid> = vi.fn();
  const setCurrentPromptDocId: MockedFunction<SetCurrentPromptDocId> = vi.fn();
  const setDisplayedPromptSilently: MockedFunction<SetDisplayedPromptSilently> = vi.fn();
  const setShowResults: MockedFunction<SetShowResults> = vi.fn();
  const applyInitialHighlightSnapshot: MockedFunction<ApplyInitialHighlightSnapshot> = vi.fn();
  const resetEditStacks: MockedFunction<ResetEditStacks> = vi.fn();
  const navigate: MockedFunction<Navigate> = vi.fn();

  return {
    promptOptimizer: createPromptOptimizer(),
    promptHistory: createPromptHistory(),
    selectedMode: 'video',
    selectedModel: 'model-a',
    generationParams: { seed: 42 } satisfies CapabilityValues,
    setConceptElements,
    setPromptContext,
    setShowBrainstorm,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    setDisplayedPromptSilently,
    setShowResults,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    persistedSignatureRef: { current: 'old' },
    skipLoadFromUrlRef: { current: false },
    navigate,
    toast: createToast(),
    ...overrides,
  };
};

describe('useConceptBrainstorm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('marks brainstorm as skipped', () => {
    const params = createDefaults();

    const { result } = renderHook(() => useConceptBrainstorm(params));

    act(() => {
      result.current.handleSkipBrainstorm();
    });

    expect(params.setShowBrainstorm).toHaveBeenCalledWith(false);
    expect(params.setConceptElements).toHaveBeenCalledWith({ skipped: true });
  });

  it('optimizes concept and updates prompt state', async () => {
    const promptOptimizer = createPromptOptimizer();
    const promptHistory = createPromptHistory();
    const params = createDefaults({ promptOptimizer, promptHistory });

    const optimizeResult: OptimizeResult = {
      optimized: 'Optimized concept prompt',
      score: 90,
    };

    const mockOptimize = promptOptimizer.optimize as MockedFunction<PromptOptimizer['optimize']>;
    const mockSaveToHistory =
      promptHistory.saveToHistory as MockedFunction<PromptHistory['saveToHistory']>;

    mockOptimize.mockResolvedValue(optimizeResult);
    mockSaveToHistory.mockResolvedValue({ uuid: 'uuid-1', id: 'doc-1' });

    const { result } = renderHook(() => useConceptBrainstorm(params));

    await act(async () => {
      await result.current.handleConceptComplete(
        'Final concept',
        { subject: 'cat' },
        { format: 'detailed' }
      );
    });

    expect(params.setConceptElements).toHaveBeenCalledWith({ subject: 'cat' });
    expect(params.setPromptContext).toHaveBeenCalledWith(expect.any(PromptContextMock));
    expect(promptOptimizer.setInputPrompt).toHaveBeenCalledWith('Final concept');
    expect(params.setShowBrainstorm).toHaveBeenCalledWith(false);

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(mockOptimize).toHaveBeenCalledWith(
      'Final concept',
      null,
      { elements: { subject: 'cat' }, metadata: { format: 'detailed' } },
      'model-a',
      { generationParams: { seed: 42 } }
    );

    expect(mockSaveToHistory).toHaveBeenCalledWith(
      'Final concept',
      'Optimized concept prompt',
      90,
      'video',
      'model-a',
      { seed: 42 },
      { elements: { subject: 'cat' }, metadata: { format: 'detailed' } }
    );

    expect(params.setDisplayedPromptSilently).toHaveBeenCalledWith('Optimized concept prompt');
    expect(params.skipLoadFromUrlRef.current).toBe(true);
    expect(params.setCurrentPromptUuid).toHaveBeenCalledWith('uuid-1');
    expect(params.setCurrentPromptDocId).toHaveBeenCalledWith('doc-1');
    expect(params.setShowResults).toHaveBeenCalledWith(true);
    expect(params.toast.success).toHaveBeenCalledWith('Video prompt generated successfully!');
    expect(params.applyInitialHighlightSnapshot).toHaveBeenCalledWith(null, {
      bumpVersion: true,
      markPersisted: false,
    });
    expect(params.resetEditStacks).toHaveBeenCalled();
    expect(params.persistedSignatureRef.current).toBeNull();
    expect(params.navigate).toHaveBeenCalledWith('/prompt/uuid-1', { replace: true });
  });

  it('shows an error when optimization fails', async () => {
    const promptOptimizer = createPromptOptimizer();
    const promptHistory = createPromptHistory();
    const params = createDefaults({ promptOptimizer, promptHistory });

    const mockOptimize = promptOptimizer.optimize as MockedFunction<PromptOptimizer['optimize']>;
    mockOptimize.mockRejectedValue(new Error('Failure'));

    const { result } = renderHook(() => useConceptBrainstorm(params));

    await act(async () => {
      await result.current.handleConceptComplete('Final concept', {}, {});
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(params.toast.error).toHaveBeenCalledWith(
      'Failed to generate video prompt. Please try again.'
    );
    expect(logSpies.error).toHaveBeenCalled();
  });
});
