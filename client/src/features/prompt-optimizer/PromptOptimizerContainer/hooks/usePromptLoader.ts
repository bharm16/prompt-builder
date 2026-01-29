import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPromptRepository } from '@repositories/index';
import { createHighlightSignature } from '@features/span-highlighting';
import { PromptContext } from '@utils/PromptContext';
import type { PromptKeyframe, PromptVersionEntry, Toast } from '@hooks/types';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';

const log = logger.child('usePromptLoader');

interface PromptData {
  id?: string;
  uuid: string;
  input?: string;
  output?: string;
  targetModel?: string | null;
  keyframes?: PromptKeyframe[] | null;
  highlightCache?: {
    signature?: string;
    updatedAt?: string;
  } | null;
  brainstormContext?: string | Record<string, unknown> | null;
  timestamp?: string;
  versions?: PromptVersionEntry[];
}

interface PromptOptimizer {
  setInputPrompt: (prompt: string) => void;
  setOptimizedPrompt: (prompt: string) => void;
  setDisplayedPrompt: (prompt: string) => void;
  setGenericOptimizedPrompt?: (prompt: string | null) => void;
  displayedPrompt: string;
  setPreviewPrompt?: (prompt: string | null) => void;
  setPreviewAspectRatio?: (ratio: string | null) => void;
}

interface UsePromptLoaderParams {
  uuid: string | null | undefined;
  currentPromptUuid: string | null | undefined;
  navigate: ReturnType<typeof useNavigate>;
  toast: Toast;
  promptOptimizer: PromptOptimizer;
  setDisplayedPromptSilently: (prompt: string) => void;
  applyInitialHighlightSnapshot: (
    highlight: HighlightSnapshot | null,
    options: { bumpVersion: boolean; markPersisted: boolean }
  ) => void;
  resetEditStacks: () => void;
  resetVersionEdits: () => void;
  setCurrentPromptDocId: (id: string | null) => void;
  setCurrentPromptUuid: (uuid: string) => void;
  setShowResults: (show: boolean) => void;
  setSelectedModel: (model: string) => void;
  setPromptContext: (context: PromptContext | null) => void;
  onLoadKeyframes?: (keyframes: PromptKeyframe[] | null | undefined) => void;
  skipLoadFromUrlRef: React.MutableRefObject<boolean>;
}

/**
 * Custom hook for loading prompts from URL parameters
 * Handles:
 * - Prompt data fetching from URL params
 * - Highlight restoration
 * - Context restoration
 */
export function usePromptLoader({
  uuid,
  currentPromptUuid,
  navigate,
  toast,
  promptOptimizer,
  setDisplayedPromptSilently,
  applyInitialHighlightSnapshot,
  resetEditStacks,
  resetVersionEdits,
  setCurrentPromptDocId,
  setCurrentPromptUuid,
  setShowResults,
  setSelectedModel,
  setPromptContext,
  onLoadKeyframes,
  skipLoadFromUrlRef,
}: UsePromptLoaderParams): { isLoading: boolean } {
  const {
    setInputPrompt,
    setOptimizedPrompt,
    setGenericOptimizedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
  } = promptOptimizer;

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Initial state: loading if we have a UUID that doesn't match current
    if (!uuid) return false;
    if (uuid === currentPromptUuid) return false;
    return true;
  });

  // Handle loading from URL parameter
  useEffect(() => {
    let cancelled = false;

    const loadPromptFromUrl = async (): Promise<void> => {
      if (!uuid) {
        setIsLoading(false);
        return;
      }

      if (skipLoadFromUrlRef.current || currentPromptUuid === uuid) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const promptRepository = getPromptRepository();
        const promptData = (await promptRepository.getByUuid(uuid)) as
          | PromptData
          | null;

        if (cancelled) return;

        if (promptData) {
          // Load prompt data
          setInputPrompt(promptData.input || '');
          setOptimizedPrompt(promptData.output || '');
          setDisplayedPromptSilently(promptData.output || '');
          setGenericOptimizedPrompt?.(null);
          setPreviewPrompt?.(null);
          setPreviewAspectRatio?.(null);
          setCurrentPromptUuid(promptData.uuid);
          setCurrentPromptDocId(promptData.id || null);
          setShowResults(true);
          setSelectedModel(typeof promptData.targetModel === 'string' ? promptData.targetModel : '');
          onLoadKeyframes?.(promptData.keyframes);

          // Restore highlight cache
          const preloadHighlight: HighlightSnapshot | null = promptData.highlightCache
            ? ({
                ...promptData.highlightCache,
                signature:
                  promptData.highlightCache.signature ??
                  createHighlightSignature(promptData.output ?? ''),
              } as HighlightSnapshot)
            : null;
          applyInitialHighlightSnapshot(preloadHighlight, {
            bumpVersion: true,
            markPersisted: true,
          });
          resetVersionEdits();
          resetEditStacks();

          if (cancelled) return;

          // Restore brainstorm context if available
          if (promptData.brainstormContext) {
            try {
              const contextData =
                typeof promptData.brainstormContext === 'string'
                  ? (JSON.parse(promptData.brainstormContext) as Record<
                      string,
                      unknown
                    >)
                  : promptData.brainstormContext;
              const restoredContext = PromptContext.fromJSON(contextData);
              setPromptContext(restoredContext);
            } catch (contextError) {
              const info = sanitizeError(contextError);
              log.warn('Failed to restore prompt context from shared link', {
                operation: 'restorePromptContext',
                promptUuid: uuid,
                error: info.message,
                errorName: info.name,
              });
              toast.warning(
                'Could not restore video context. The prompt will still load.'
              );
              setPromptContext(null);
            }
          } else {
            setPromptContext(null);
          }
        } else {
          log.warn('Prompt not found for URL parameter', { operation: 'loadPromptFromUrl', promptUuid: uuid });
          navigate('/', { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(sanitizeError(error).message);
        log.error('Error loading prompt from URL', err, { operation: 'loadPromptFromUrl', promptUuid: uuid });
        toast.error('Failed to load prompt');
        navigate('/', { replace: true });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPromptFromUrl();

    return () => {
      cancelled = true;
    };
  }, [
    uuid,
    currentPromptUuid,
    navigate,
    toast,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    resetVersionEdits,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
    setShowResults,
    setSelectedModel,
    setPromptContext,
    onLoadKeyframes,
    skipLoadFromUrlRef,
    setInputPrompt,
    setOptimizedPrompt,
    setGenericOptimizedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
  ]);

  return { isLoading };
}
