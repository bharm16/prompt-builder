import { useEffect } from 'react';
import { getPromptRepository } from '../../../../repositories';
import { createHighlightSignature } from '../../hooks/useSpanLabeling.js';
import { PromptContext } from '../../../../utils/PromptContext';

/**
 * Custom hook for loading prompts from URL parameters
 * Handles prompt data fetching, highlight restoration, and context restoration
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
}) {
  useEffect(() => {
    const loadPromptFromUrl = async () => {
      if (!uuid) return;
      if (skipLoadFromUrlRef.current || currentPromptUuid === uuid) return;

      try {
        const promptRepository = getPromptRepository();
        const promptData = await promptRepository.getByUuid(uuid);
        
        if (promptData) {
          // Load prompt data
          promptOptimizer.setInputPrompt(promptData.input);
          promptOptimizer.setOptimizedPrompt(promptData.output);
          setDisplayedPromptSilently(promptData.output);
          setCurrentPromptUuid(promptData.uuid);
          setCurrentPromptDocId(promptData.id || null);
          setShowResults(true);

          // Restore highlight cache
          const preloadHighlight = promptData.highlightCache
            ? {
                ...promptData.highlightCache,
                signature: promptData.highlightCache.signature ?? 
                          createHighlightSignature(promptData.output ?? ''),
              }
            : null;
          applyInitialHighlightSnapshot(preloadHighlight, { 
            bumpVersion: true, 
            markPersisted: true 
          });
          resetEditStacks();

          // Restore brainstorm context if available
          if (promptData.brainstormContext) {
            try {
              const contextData =
                typeof promptData.brainstormContext === 'string'
                  ? JSON.parse(promptData.brainstormContext)
                  : promptData.brainstormContext;
              const restoredContext = PromptContext.fromJSON(contextData);
              setPromptContext(restoredContext);
            } catch (contextError) {
              console.error('Failed to restore prompt context from shared link:', contextError);
              toast.warning('Could not restore video context. The prompt will still load.');
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
  ]);
}

