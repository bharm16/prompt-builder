import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPromptRepositoryForUser } from '@repositories/index';
import { createHighlightSignature } from '@features/span-highlighting';
import { PromptContext } from '@utils/PromptContext';
import type { PromptKeyframe, PromptVersionEntry } from '@features/prompt-optimizer/types/domain/prompt-session';
import type { Toast } from '@hooks/types';
import type { HighlightSnapshot } from '@features/prompt-optimizer/context/types';
import { logger } from '@/services/LoggingService';
import { sanitizeError } from '@/utils/logging';

const log = logger.child('usePromptLoader');
const isRemoteSessionId = (value: string): boolean => {
  const normalized = value.trim();
  return normalized.length > 0 && !normalized.startsWith('draft-');
};

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
  sessionId: string | null | undefined;
  currentPromptUuid: string | null | undefined;
  navigate: ReturnType<typeof useNavigate>;
  toast: Toast;
  user: { uid: string } | null;
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
 * Custom hook for loading prompts from session route parameters
 */
export function usePromptLoader({
  sessionId,
  navigate,
  toast,
  user,
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
  const isAuthenticated = Boolean(user?.uid);
  const {
    setInputPrompt,
    setOptimizedPrompt,
    setGenericOptimizedPrompt,
    setPreviewPrompt,
    setPreviewAspectRatio,
  } = promptOptimizer;

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    if (!sessionId) return false;
    return true;
  });
  const lastLoadedSessionKeyRef = useRef<string | null>(null);
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let cancelled = false;

    const loadPromptFromSession = async (): Promise<void> => {
      const normalizedSessionId = sessionId?.trim() ?? '';
      if (!normalizedSessionId) {
        setIsLoading(false);
        return;
      }

      if (skipLoadFromUrlRef.current) {
        setIsLoading(false);
        return;
      }

      const sessionKey = `${normalizedSessionId}::${user?.uid ?? 'anonymous'}`;
      if (!isRemoteSessionId(normalizedSessionId)) {
        lastLoadedSessionKeyRef.current = sessionKey;
        setIsLoading(false);
        return;
      }

      if (lastLoadedSessionKeyRef.current === sessionKey) {
        setIsLoading(false);
        return;
      }

      // Dedupe repeated effect reruns while a load is in-flight or after a failure.
      lastLoadedSessionKeyRef.current = sessionKey;
      setIsLoading(true);

      try {
        const promptRepository = getPromptRepositoryForUser(isAuthenticated);
        const promptData = (await promptRepository.getById(normalizedSessionId)) as
          | PromptData
          | null;

        if (cancelled) return;

        if (promptData) {
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
              log.warn('Failed to restore prompt context from session', {
                operation: 'restorePromptContext',
                sessionId: normalizedSessionId,
                error: info.message,
                errorName: info.name,
              });
              toastRef.current.warning(
                'Could not restore video context. The prompt will still load.'
              );
              setPromptContext(null);
            }
          } else {
            setPromptContext(null);
          }
        } else {
          log.warn('Prompt not found for session', { operation: 'loadPromptFromSession', sessionId: normalizedSessionId });
          navigate('/', { replace: true });
        }
      } catch (error) {
        if (cancelled) return;
        const err = error instanceof Error ? error : new Error(sanitizeError(error).message);
        log.error('Error loading prompt from session', err, { operation: 'loadPromptFromSession', sessionId: normalizedSessionId });
        toastRef.current.error('Failed to load prompt');
        navigate('/', { replace: true });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPromptFromSession();

    return () => {
      cancelled = true;
    };
  }, [
    sessionId,
    navigate,
    user?.uid,
    isAuthenticated,
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
