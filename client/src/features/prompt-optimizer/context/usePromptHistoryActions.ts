import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { createHighlightSignature } from '@/features/span-highlighting';
import { PromptContext } from '@utils/PromptContext/PromptContext';
import type { CapabilityValues } from '@shared/capabilities';
import type { useDebugLogger } from '@hooks/useDebugLogger';
import type { usePromptOptimizer } from '@hooks/usePromptOptimizer';
import type { HighlightSnapshot, PromptHistoryEntry } from './types';
import type { SuggestionsData } from '../PromptCanvas/types';

type DebugLogger = ReturnType<typeof useDebugLogger>;
type PromptOptimizer = ReturnType<typeof usePromptOptimizer>;

interface PromptHistoryActionsOptions {
  debug: DebugLogger;
  navigate: NavigateFunction;
  promptOptimizer: PromptOptimizer;
  promptHistory: {
    createDraft: (params: {
      mode: string;
      targetModel: string | null;
      generationParams: Record<string, unknown> | null;
      keyframes?: PromptHistoryEntry['keyframes'];
      uuid?: string;
    }) => { uuid: string; id: string };
  };
  selectedMode: string;
  selectedModel: string;
  generationParams: CapabilityValues;
  applyInitialHighlightSnapshot: (
    snapshot: HighlightSnapshot | null,
    options?: { bumpVersion?: boolean; markPersisted?: boolean }
  ) => void;
  resetEditStacks: () => void;
  resetVersionEdits: () => void;
  setSuggestionsData: (data: SuggestionsData | null) => void;
  setConceptElements: (data: unknown | null) => void;
  setPromptContext: (context: PromptContext | null) => void;
  setGenerationParams: (params: CapabilityValues) => void;
  setSelectedMode: (mode: string) => void;
  setSelectedModel: (model: string) => void;
  setShowResults: (show: boolean) => void;
  setCurrentPromptUuid: (value: string | null) => void;
  setCurrentPromptDocId: (value: string | null) => void;
  persistedSignatureRef: React.MutableRefObject<string | null>;
  isApplyingHistoryRef: React.MutableRefObject<boolean>;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
}

interface PromptHistoryActionsResult {
  setDisplayedPromptSilently: (text: string) => void;
  handleCreateNew: () => void;
  loadFromHistory: (entry: PromptHistoryEntry) => void;
}

export const usePromptHistoryActions = ({
  debug,
  navigate,
  promptOptimizer,
  promptHistory,
  selectedMode,
  selectedModel,
  generationParams,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  resetVersionEdits,
  setSuggestionsData,
  setConceptElements,
  setPromptContext,
  setGenerationParams,
  setSelectedMode,
  setSelectedModel,
  setShowResults,
  setCurrentPromptUuid,
  setCurrentPromptDocId,
  persistedSignatureRef,
  isApplyingHistoryRef,
  skipLoadFromUrlRef,
}: PromptHistoryActionsOptions): PromptHistoryActionsResult => {
  const setDisplayedPromptSilently = useCallback(
    (text: string): void => {
      isApplyingHistoryRef.current = true;
      promptOptimizer.setDisplayedPrompt(text);
      setTimeout(() => {
        isApplyingHistoryRef.current = false;
      }, 0);
    },
    [promptOptimizer, isApplyingHistoryRef]
  );

  const handleCreateNew = useCallback((): void => {
    debug.logAction('createNew');
    skipLoadFromUrlRef.current = true;
    promptOptimizer.resetPrompt();
    setShowResults(false);
    setSuggestionsData(null);
    setConceptElements(null);
    setPromptContext(null);
    resetVersionEdits();
    const draft = promptHistory.createDraft({
      mode: selectedMode,
      targetModel: selectedModel?.trim() ? selectedModel.trim() : null,
      generationParams: (generationParams as unknown as Record<string, unknown>) ?? null,
    });
    setCurrentPromptUuid(draft.uuid);
    setCurrentPromptDocId(draft.id);
    applyInitialHighlightSnapshot(null, { bumpVersion: true, markPersisted: false });
    persistedSignatureRef.current = null;
    resetEditStacks();
    if (draft.id) {
      navigate(`/session/${draft.id}/studio`, { replace: true });
    } else {
      navigate('/create', { replace: true });
    }
    // Allow future URL-based loads after the draft navigation settles.
    // Mirror the `loadFromHistory` behavior to avoid leaving this ref stuck `true`.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        skipLoadFromUrlRef.current = false;
      });
    });
    window.setTimeout(() => {
      window.dispatchEvent(new Event('po:focus-editor'));
    }, 0);
    debug.logAction('createNewComplete');
  }, [
    debug,
    skipLoadFromUrlRef,
    promptOptimizer,
    promptHistory,
    selectedMode,
    selectedModel,
    generationParams,
    setShowResults,
    setSuggestionsData,
    setConceptElements,
    setPromptContext,
    setCurrentPromptUuid,
    setCurrentPromptDocId,
    applyInitialHighlightSnapshot,
    persistedSignatureRef,
    resetEditStacks,
    resetVersionEdits,
    navigate,
  ]);

  const loadFromHistory = useCallback(
    (entry: PromptHistoryEntry): void => {
      debug.logAction('loadFromHistory', {
        uuid: entry.uuid,
        mode: entry.mode,
        hasContext: !!entry.brainstormContext,
        hasHighlightCache: !!entry.highlightCache,
      });
      debug.startTimer('loadFromHistory');

      skipLoadFromUrlRef.current = true;
      setCurrentPromptUuid(entry.uuid || null);
      setCurrentPromptDocId(entry.id || null);

      promptOptimizer.setInputPrompt(entry.input);
      promptOptimizer.setOptimizedPrompt(entry.output);
      setDisplayedPromptSilently(entry.output);
      if (promptOptimizer.setPreviewPrompt) {
        promptOptimizer.setPreviewPrompt(null);
      }
      if (promptOptimizer.setPreviewAspectRatio) {
        promptOptimizer.setPreviewAspectRatio(null);
      }
      setSelectedMode('video');
      setSelectedModel(typeof entry.targetModel === 'string' ? entry.targetModel : '');
      setGenerationParams(
        entry.generationParams && typeof entry.generationParams === 'object'
          ? (entry.generationParams as CapabilityValues)
          : {}
      );
      setShowResults(Boolean(entry.output && entry.output.trim()));

      const preloadedHighlight: HighlightSnapshot | null = entry.highlightCache
        ? ({
            ...(entry.highlightCache as Record<string, unknown>),
            signature:
              (entry.highlightCache as { signature?: string })?.signature ??
              createHighlightSignature(entry.output ?? ''),
          } as HighlightSnapshot)
        : null;

      applyInitialHighlightSnapshot(preloadedHighlight, { bumpVersion: true, markPersisted: true });
      resetVersionEdits();
      resetEditStacks();

      if (entry.brainstormContext) {
        try {
          const contextData =
            typeof entry.brainstormContext === 'string'
              ? JSON.parse(entry.brainstormContext)
              : entry.brainstormContext;
          const restoredContext = PromptContext.fromJSON(contextData);
          setPromptContext(restoredContext);
          debug.logAction('contextRestored');
        } catch (contextError) {
          debug.logError(
            'Failed to restore prompt context from history entry',
            contextError as Error
          );
          setPromptContext(null);
        }
      } else {
        setPromptContext(null);
      }

      if (entry.id) {
        navigate(`/session/${entry.id}/studio`, { replace: true });
      } else if (entry.uuid) {
        navigate('/create', { replace: true });
      } else {
        navigate('/', { replace: true });
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          skipLoadFromUrlRef.current = false;
          debug.endTimer('loadFromHistory', 'History entry loaded');
        });
      });
    },
    [
      debug,
      skipLoadFromUrlRef,
      setCurrentPromptUuid,
      setCurrentPromptDocId,
      promptOptimizer,
      setDisplayedPromptSilently,
      setSelectedMode,
      setSelectedModel,
      setGenerationParams,
      setShowResults,
      applyInitialHighlightSnapshot,
      resetEditStacks,
      resetVersionEdits,
      setPromptContext,
      navigate,
    ]
  );

  return {
    setDisplayedPromptSilently,
    handleCreateNew,
    loadFromHistory,
  };
};
