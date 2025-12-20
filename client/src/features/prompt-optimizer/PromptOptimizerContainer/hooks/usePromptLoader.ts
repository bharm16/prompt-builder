import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getPromptRepository } from '@repositories/index';
import { createHighlightSignature } from '@features/span-highlighting';
import { PromptContext } from '@utils/PromptContext';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';

interface PromptData {
  id?: string;
  uuid: string;
  input?: string;
  output?: string;
  highlightCache?: {
    signature?: string;
    updatedAt?: string;
    [key: string]: unknown;
  } | null;
  brainstormContext?: string | Record<string, unknown> | null;
  timestamp?: string;
  versions?: unknown[];
  [key: string]: unknown;
}

interface PromptOptimizer {
  setInputPrompt: (prompt: string) => void;
  setOptimizedPrompt: (prompt: string) => void;
  setDisplayedPrompt: (prompt: string) => void;
  displayedPrompt: string;
  setPreviewPrompt?: (prompt: string | null) => void;
  [key: string]: unknown;
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
  setCurrentPromptDocId: (id: string | null) => void;
  setCurrentPromptUuid: (uuid: string) => void;
  setShowResults: (show: boolean) => void;
  setPromptContext: (context: PromptContext | null) => void;
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
  setCurrentPromptDocId,
  setCurrentPromptUuid,
  setShowResults,
  setPromptContext,
  skipLoadFromUrlRef,
}: UsePromptLoaderParams): void {
  const location = useLocation();

  // Handle loading from URL parameter
  useEffect(() => {
    const loadPromptFromUrl = async (): Promise<void> => {
      if (!uuid) return;
      if (skipLoadFromUrlRef.current || currentPromptUuid === uuid) return;

      try {
        const promptRepository = getPromptRepository();
        const promptData = (await promptRepository.getByUuid(uuid)) as
          | PromptData
          | null;

        if (promptData) {
          // Load prompt data
          promptOptimizer.setInputPrompt(promptData.input || '');
          promptOptimizer.setOptimizedPrompt(promptData.output || '');
          setDisplayedPromptSilently(promptData.output || '');
          promptOptimizer.setPreviewPrompt?.(null);
          setCurrentPromptUuid(promptData.uuid);
          setCurrentPromptDocId(promptData.id || null);
          setShowResults(true);

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
          resetEditStacks();

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
              console.error(
                'Failed to restore prompt context from shared link:',
                contextError
              );
              toast.warning(
                'Could not restore video context. The prompt will still load.'
              );
              setPromptContext(null);
            }
          } else {
            setPromptContext(null);
          }
        } else {
          toast.error('Prompt not found');
          navigate('/', { replace: true });
        }
      } catch (error) {
        console.error('Error loading prompt from URL:', error);
        toast.error('Failed to load prompt');
        navigate('/', { replace: true });
      }
    };

    loadPromptFromUrl();
  }, [
    uuid,
    currentPromptUuid,
    navigate,
    toast,
    promptOptimizer,
    setDisplayedPromptSilently,
    applyInitialHighlightSnapshot,
    resetEditStacks,
    setCurrentPromptDocId,
    setCurrentPromptUuid,
    setShowResults,
    setPromptContext,
    skipLoadFromUrlRef,
    location,
  ]);
}
