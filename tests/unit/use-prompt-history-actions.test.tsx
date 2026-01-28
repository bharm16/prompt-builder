import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { usePromptHistoryActions } from '@features/prompt-optimizer/context/usePromptHistoryActions';
import { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CapabilityValues } from '@shared/capabilities';
import type { PromptHistoryEntry } from '@hooks/types';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';
import type { SuggestionsData } from '@features/prompt-optimizer/PromptCanvas/types';
import { createHighlightSignature } from '@features/span-highlighting';

vi.mock('@features/span-highlighting', () => ({
  createHighlightSignature: vi.fn(),
}));

const mockCreateHighlightSignature = vi.mocked(createHighlightSignature);

type UsePromptHistoryActionsOptions = Parameters<typeof usePromptHistoryActions>[0];
type PromptOptimizer = UsePromptHistoryActionsOptions['promptOptimizer'];

const createTrackedSetter = <T,>(initial: T) => {
  let value = initial;
  const setter = vi.fn((next: T) => {
    value = next;
  });
  return { get: () => value, setter };
};

const createPromptOptimizer = () => {
  const state = {
    inputPrompt: '',
    optimizedPrompt: '',
    displayedPrompt: '',
    previewPrompt: 'preview',
    previewAspectRatio: '16:9',
  };

  const optimizer = {
    inputPrompt: state.inputPrompt,
    optimizedPrompt: state.optimizedPrompt,
    displayedPrompt: state.displayedPrompt,
    previewPrompt: state.previewPrompt,
    previewAspectRatio: state.previewAspectRatio,
    setInputPrompt: vi.fn((prompt: string) => {
      state.inputPrompt = prompt;
      optimizer.inputPrompt = prompt;
    }),
    setOptimizedPrompt: vi.fn((prompt: string) => {
      state.optimizedPrompt = prompt;
      optimizer.optimizedPrompt = prompt;
    }),
    setDisplayedPrompt: vi.fn((prompt: string) => {
      state.displayedPrompt = prompt;
      optimizer.displayedPrompt = prompt;
    }),
    setPreviewPrompt: vi.fn((prompt: string | null) => {
      state.previewPrompt = prompt;
      optimizer.previewPrompt = prompt;
    }),
    setPreviewAspectRatio: vi.fn((ratio: string | null) => {
      state.previewAspectRatio = ratio;
      optimizer.previewAspectRatio = ratio;
    }),
    resetPrompt: vi.fn(() => {
      state.inputPrompt = '';
      state.optimizedPrompt = '';
      state.displayedPrompt = '';
      optimizer.inputPrompt = '';
      optimizer.optimizedPrompt = '';
      optimizer.displayedPrompt = '';
    }),
  } as PromptOptimizer;

  return { optimizer, state };
};

const createDebugLogger = (): UsePromptHistoryActionsOptions['debug'] => ({
  logAction: vi.fn(),
  startTimer: vi.fn(),
  endTimer: vi.fn(),
  logError: vi.fn(),
});

const setupRafQueue = () => {
  const callbacks: FrameRequestCallback[] = [];
  const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.push(callback);
    return callbacks.length;
  });

  const flush = () => {
    const pending = callbacks.splice(0);
    pending.forEach((callback) => callback(0));
  };

  return { rafSpy, flush };
};

describe('usePromptHistoryActions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockCreateHighlightSignature.mockReturnValue('sig-default');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('logs and clears context when brainstorm JSON is invalid', () => {
      const { optimizer } = createPromptOptimizer();
      const debug = createDebugLogger();
      const { flush, rafSpy } = setupRafQueue();
      const promptContextTracker = createTrackedSetter<PromptContext | null>(new PromptContext());

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft: vi.fn() },
          selectedMode: 'video',
          selectedModel: 'model-a',
          generationParams: { steps: 3 },
          applyInitialHighlightSnapshot: vi.fn(),
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: vi.fn(),
          setConceptElements: vi.fn(),
          setPromptContext: promptContextTracker.setter,
          setGenerationParams: vi.fn(),
          setSelectedMode: vi.fn(),
          setSelectedModel: vi.fn(),
          setShowResults: vi.fn(),
          setCurrentPromptUuid: vi.fn(),
          setCurrentPromptDocId: vi.fn(),
          persistedSignatureRef: { current: 'sig-old' },
          isApplyingHistoryRef: { current: false },
          skipLoadFromUrlRef: { current: false },
        })
      );

      const entry: PromptHistoryEntry = {
        uuid: 'uuid-1',
        id: 'doc-1',
        input: 'Input',
        output: 'Output',
        brainstormContext: '{not-json',
      };

      act(() => {
        result.current.loadFromHistory(entry);
      });

      flush();
      flush();
      rafSpy.mockRestore();

      expect(debug.logError).toHaveBeenCalled();
      expect(promptContextTracker.get()).toBeNull();
    });

    it('falls back to defaults for invalid model and params', () => {
      const { optimizer } = createPromptOptimizer();
      const debug = createDebugLogger();
      const { flush, rafSpy } = setupRafQueue();
      const selectedModelTracker = createTrackedSetter('initial');
      const paramsTracker = createTrackedSetter<CapabilityValues>({ steps: 1 });

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft: vi.fn() },
          selectedMode: 'video',
          selectedModel: 'model-a',
          generationParams: { steps: 3 },
          applyInitialHighlightSnapshot: vi.fn(),
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: vi.fn(),
          setConceptElements: vi.fn(),
          setPromptContext: vi.fn(),
          setGenerationParams: paramsTracker.setter,
          setSelectedMode: vi.fn(),
          setSelectedModel: selectedModelTracker.setter,
          setShowResults: vi.fn(),
          setCurrentPromptUuid: vi.fn(),
          setCurrentPromptDocId: vi.fn(),
          persistedSignatureRef: { current: 'sig-old' },
          isApplyingHistoryRef: { current: false },
          skipLoadFromUrlRef: { current: false },
        })
      );

      const entry: PromptHistoryEntry = {
        uuid: 'uuid-2',
        id: 'doc-2',
        input: 'Input',
        output: 'Output',
        targetModel: 123,
        generationParams: 'bad',
      };

      act(() => {
        result.current.loadFromHistory(entry);
      });

      flush();
      flush();
      rafSpy.mockRestore();

      expect(selectedModelTracker.get()).toBe('');
      expect(paramsTracker.get()).toEqual({});
    });

    it('passes a null target model when the selection is whitespace', () => {
      const { optimizer } = createPromptOptimizer();
      const debug = createDebugLogger();
      const { flush, rafSpy } = setupRafQueue();
      const draftResult = { uuid: 'uuid-3', id: 'doc-3' };
      const createDraft: MockedFunction<UsePromptHistoryActionsOptions['promptHistory']['createDraft']> =
        vi.fn(() => draftResult);
      const promptUuidTracker = createTrackedSetter<string | null>(null);
      const skipLoadFromUrlRef = { current: false };

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft },
          selectedMode: 'video',
          selectedModel: '   ',
          generationParams: { steps: 3 },
          applyInitialHighlightSnapshot: vi.fn(),
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: vi.fn(),
          setConceptElements: vi.fn(),
          setPromptContext: vi.fn(),
          setGenerationParams: vi.fn(),
          setSelectedMode: vi.fn(),
          setSelectedModel: vi.fn(),
          setShowResults: vi.fn(),
          setCurrentPromptUuid: promptUuidTracker.setter,
          setCurrentPromptDocId: vi.fn(),
          persistedSignatureRef: { current: 'sig-old' },
          isApplyingHistoryRef: { current: false },
          skipLoadFromUrlRef,
        })
      );

      act(() => {
        result.current.handleCreateNew();
      });

      expect(skipLoadFromUrlRef.current).toBe(true);
      expect(createDraft).toHaveBeenCalledWith(
        expect.objectContaining({ targetModel: null })
      );
      expect(promptUuidTracker.get()).toBe('uuid-3');

      flush();
      flush();
      rafSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('derives a highlight signature when the cache is missing one', () => {
      const { optimizer } = createPromptOptimizer();
      const debug = createDebugLogger();
      const { flush, rafSpy } = setupRafQueue();
      let appliedSnapshot: HighlightSnapshot | null = null;

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft: vi.fn() },
          selectedMode: 'video',
          selectedModel: 'model-a',
          generationParams: { steps: 3 },
          applyInitialHighlightSnapshot: (snapshot) => {
            appliedSnapshot = snapshot;
          },
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: vi.fn(),
          setConceptElements: vi.fn(),
          setPromptContext: vi.fn(),
          setGenerationParams: vi.fn(),
          setSelectedMode: vi.fn(),
          setSelectedModel: vi.fn(),
          setShowResults: vi.fn(),
          setCurrentPromptUuid: vi.fn(),
          setCurrentPromptDocId: vi.fn(),
          persistedSignatureRef: { current: 'sig-old' },
          isApplyingHistoryRef: { current: false },
          skipLoadFromUrlRef: { current: false },
        })
      );

      const entry: PromptHistoryEntry = {
        uuid: 'uuid-4',
        id: 'doc-4',
        input: 'Input',
        output: 'Output text',
        highlightCache: { spans: [] },
      };

      act(() => {
        result.current.loadFromHistory(entry);
      });

      flush();
      flush();
      rafSpy.mockRestore();

      expect(mockCreateHighlightSignature).toHaveBeenCalledWith('Output text');
      expect(appliedSnapshot?.signature).toBe('sig-default');
    });

    it('toggles the applying-history flag when setting prompts silently', () => {
      const { optimizer } = createPromptOptimizer();
      const debug = createDebugLogger();

      const isApplyingHistoryRef = { current: false };

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft: vi.fn() },
          selectedMode: 'video',
          selectedModel: 'model-a',
          generationParams: { steps: 3 },
          applyInitialHighlightSnapshot: vi.fn(),
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: vi.fn(),
          setConceptElements: vi.fn(),
          setPromptContext: vi.fn(),
          setGenerationParams: vi.fn(),
          setSelectedMode: vi.fn(),
          setSelectedModel: vi.fn(),
          setShowResults: vi.fn(),
          setCurrentPromptUuid: vi.fn(),
          setCurrentPromptDocId: vi.fn(),
          persistedSignatureRef: { current: 'sig-old' },
          isApplyingHistoryRef,
          skipLoadFromUrlRef: { current: false },
        })
      );

      act(() => {
        result.current.setDisplayedPromptSilently('Hidden prompt');
      });

      expect(isApplyingHistoryRef.current).toBe(true);
      expect(optimizer.displayedPrompt).toBe('Hidden prompt');

      act(() => {
        vi.runAllTimers();
      });

      expect(isApplyingHistoryRef.current).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('creates a draft, resets state, and navigates on new prompts', () => {
      const { optimizer, state } = createPromptOptimizer();
      const debug = createDebugLogger();
      const { flush, rafSpy } = setupRafQueue();
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const createDraft: MockedFunction<UsePromptHistoryActionsOptions['promptHistory']['createDraft']> =
        vi.fn(() => ({ uuid: 'uuid-new', id: 'doc-new' }));
      const suggestionsTracker = createTrackedSetter<SuggestionsData | null>(null);
      const conceptTracker = createTrackedSetter<unknown | null>(null);
      const contextTracker = createTrackedSetter<PromptContext | null>(null);
      const showResultsTracker = createTrackedSetter(true);
      const promptUuidTracker = createTrackedSetter<string | null>(null);
      const promptDocIdTracker = createTrackedSetter<string | null>(null);
      const persistedSignatureRef = { current: 'sig-old' };
      const skipLoadFromUrlRef = { current: false };

      state.inputPrompt = 'Keep?';
      optimizer.inputPrompt = 'Keep?';

      const { result } = renderHook(() =>
        usePromptHistoryActions({
          debug,
          navigate: vi.fn(),
          promptOptimizer: optimizer,
          promptHistory: { createDraft },
          selectedMode: 'video',
          selectedModel: 'model-a',
          generationParams: { steps: 4 },
          applyInitialHighlightSnapshot: vi.fn(),
          resetEditStacks: vi.fn(),
          resetVersionEdits: vi.fn(),
          setSuggestionsData: suggestionsTracker.setter,
          setConceptElements: conceptTracker.setter,
          setPromptContext: contextTracker.setter,
          setGenerationParams: vi.fn(),
          setSelectedMode: vi.fn(),
          setSelectedModel: vi.fn(),
          setShowResults: showResultsTracker.setter,
          setCurrentPromptUuid: promptUuidTracker.setter,
          setCurrentPromptDocId: promptDocIdTracker.setter,
          persistedSignatureRef,
          isApplyingHistoryRef: { current: false },
          skipLoadFromUrlRef,
        })
      );

      act(() => {
        result.current.handleCreateNew();
      });

      expect(skipLoadFromUrlRef.current).toBe(true);
      expect(promptUuidTracker.get()).toBe('uuid-new');
      expect(promptDocIdTracker.get()).toBe('doc-new');
      expect(showResultsTracker.get()).toBe(false);
      expect(suggestionsTracker.get()).toBeNull();
      expect(conceptTracker.get()).toBeNull();
      expect(contextTracker.get()).toBeNull();
      expect(persistedSignatureRef.current).toBeNull();
      expect(optimizer.inputPrompt).toBe('');

      act(() => {
        vi.runAllTimers();
      });

      expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'po:focus-editor' }));

      flush();
      flush();
      rafSpy.mockRestore();
      dispatchSpy.mockRestore();

      expect(skipLoadFromUrlRef.current).toBe(false);
    });
  });
});
