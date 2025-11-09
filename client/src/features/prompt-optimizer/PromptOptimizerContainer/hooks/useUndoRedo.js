import { useCallback, useEffect, useRef } from 'react';
import { PERFORMANCE_CONFIG } from '../../../../config/performance.config';

/**
 * Custom hook for undo/redo functionality with stack management
 * Manages undo/redo stacks and provides handlers for undo/redo operations
 */
export function useUndoRedo({
  promptOptimizer,
  setDisplayedPromptSilently,
  applyInitialHighlightSnapshot,
  undoStackRef,
  redoStackRef,
  latestHighlightRef,
  isApplyingHistoryRef,
}) {
  // Track setTimeout IDs for cleanup
  const undoTimeoutRef = useRef(null);
  const redoTimeoutRef = useRef(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (redoTimeoutRef.current) clearTimeout(redoTimeoutRef.current);
    };
  }, []);

  /**
   * Handle undo operation
   */
  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) return;

    const previous = undoStackRef.current.pop();
    const currentSnapshot = {
      text: promptOptimizer.displayedPrompt,
      highlight: latestHighlightRef.current,
    };
    redoStackRef.current = [...redoStackRef.current, currentSnapshot].slice(
      -PERFORMANCE_CONFIG.UNDO_STACK_SIZE
    );

    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(previous.text);
    promptOptimizer.setOptimizedPrompt(previous.text);
    applyInitialHighlightSnapshot(previous.highlight ?? null, { 
      bumpVersion: true, 
      markPersisted: false 
    });

    // Clear any existing timeout and set new one
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      isApplyingHistoryRef.current = false;
      undoTimeoutRef.current = null;
    }, PERFORMANCE_CONFIG.REF_RESET_DELAY_MS);
  }, [
    applyInitialHighlightSnapshot,
    promptOptimizer,
    setDisplayedPromptSilently,
    undoStackRef,
    redoStackRef,
    latestHighlightRef,
    isApplyingHistoryRef,
  ]);

  /**
   * Handle redo operation
   */
  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return;

    const next = redoStackRef.current.pop();
    undoStackRef.current = [...undoStackRef.current, {
      text: promptOptimizer.displayedPrompt,
      highlight: latestHighlightRef.current,
    }].slice(-PERFORMANCE_CONFIG.UNDO_STACK_SIZE);

    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(next.text);
    promptOptimizer.setOptimizedPrompt(next.text);
    applyInitialHighlightSnapshot(next.highlight ?? null, { 
      bumpVersion: true, 
      markPersisted: false 
    });

    // Clear any existing timeout and set new one
    if (redoTimeoutRef.current) clearTimeout(redoTimeoutRef.current);
    redoTimeoutRef.current = setTimeout(() => {
      isApplyingHistoryRef.current = false;
      redoTimeoutRef.current = null;
    }, PERFORMANCE_CONFIG.REF_RESET_DELAY_MS);
  }, [
    applyInitialHighlightSnapshot,
    promptOptimizer,
    setDisplayedPromptSilently,
    undoStackRef,
    redoStackRef,
    latestHighlightRef,
    isApplyingHistoryRef,
  ]);

  /**
   * Handle displayed prompt changes with undo/redo support
   */
  const handleDisplayedPromptChange = useCallback(
    (newText) => {
      const currentText = promptOptimizer.displayedPrompt;

      // Skip undo/redo tracking if applying from history
      if (isApplyingHistoryRef.current) {
        isApplyingHistoryRef.current = false;
        promptOptimizer.setDisplayedPrompt(newText);
        return;
      }

      // Add to undo stack if text changed
      if (currentText !== newText) {
        undoStackRef.current = [
          ...undoStackRef.current,
          {
            text: currentText,
            highlight: latestHighlightRef.current,
          },
        ].slice(-PERFORMANCE_CONFIG.UNDO_STACK_SIZE);
        redoStackRef.current = []; // Clear redo stack on new change
      }

      promptOptimizer.setDisplayedPrompt(newText);
    },
    [promptOptimizer, isApplyingHistoryRef, undoStackRef, redoStackRef, latestHighlightRef]
  );

  return {
    handleUndo,
    handleRedo,
    handleDisplayedPromptChange,
  };
}

