import { useCallback, useEffect, useRef, useState } from 'react';
import { PERFORMANCE_CONFIG } from '../../../../config/performance.config';

/**
 * Custom hook for undo/redo functionality with smart edit grouping.
 * LOGIC OVERVIEW:
 * - Undo Stack: Always holds the state *prior* to the current view.
 * - Redo Stack: Holds 'future' states after an undo.
 * - Edit Grouping: Prevents every character from creating a history entry.
 *   Instead, we group bursts of typing into single entries.
 */
export function useUndoRedo({
  promptOptimizer,
  setDisplayedPromptSilently,
  applyInitialHighlightSnapshot,
  undoStackRef,
  redoStackRef,
  latestHighlightRef,
  isApplyingHistoryRef,
  setCanUndo,
  setCanRedo,
}) {
  // Track setTimeout IDs for cleanup
  const undoTimeoutRef = useRef(null);
  const redoTimeoutRef = useRef(null);
  
  // Edit grouping state
  const lastEditTimeRef = useRef(0);
  const lastCursorPositionRef = useRef(null);
  const pendingChangeRef = useRef(null); // 'adding' | 'deleting' | null
  
  // Version tracking for future UI features
  const [versionCounter, setVersionCounter] = useState(0);
  
  // Smart edit grouping thresholds
  const EDIT_GROUP_TIME_MS = 400; // 300-500ms is the sweet spot for "thought grouping"
  const SIGNIFICANT_CHANGE_THRESHOLD = 20; // Characters added/removed
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      if (redoTimeoutRef.current) clearTimeout(redoTimeoutRef.current);
    };
  }, []);

  /**
   * Helper to sync ref stacks with React state
   */
  const updateUIState = useCallback(() => {
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, [setCanUndo, setCanRedo, undoStackRef, redoStackRef]);

  /**
   * Create a snapshot of current state with metadata
   */
  const createSnapshot = useCallback((text = null, highlight = null) => ({
    text: text ?? promptOptimizer.displayedPrompt,
    highlight: highlight ?? latestHighlightRef.current,
    timestamp: Date.now(),
    version: versionCounter,
  }), [promptOptimizer.displayedPrompt, latestHighlightRef, versionCounter]);

  /**
   * Determines if a new undo point should be created
   */
  const shouldCreateUndoPoint = useCallback((currentText, newText, cursorPosition) => {
    const now = Date.now();
    const timeSinceLastEdit = now - lastEditTimeRef.current;
    const textLengthDiff = Math.abs(newText.length - currentText.length);
    
    // Always create undo point if stack is empty
    if (undoStackRef.current.length === 0) return true;

    // 1. Time-based grouping (User paused thinking)
    if (timeSinceLastEdit > EDIT_GROUP_TIME_MS) return true;

    // 2. Large change detection (Paste or Bulk Delete)
    if (textLengthDiff > SIGNIFICANT_CHANGE_THRESHOLD) return true;

    // 3. Direction change (Switching from typing to backspacing creates a new group)
    // This allows users to undo their typos without undoing the whole sentence
    if (pendingChangeRef.current === 'adding' && currentText.length > newText.length) return true;
    if (pendingChangeRef.current === 'deleting' && currentText.length < newText.length) return true;

    // 4. Cursor jump detection (if cursor position is provided)
    // If cursor info is available and moved significantly
    const lastCursor = lastCursorPositionRef.current;
    if (lastCursor !== null && cursorPosition !== null) {
      const distance = Math.abs(cursorPosition - lastCursor);
      // If distance is > 1 (and not just the char we typed), they moved the cursor
      if (distance > textLengthDiff + 1) return true; 
    }

    return false;
  }, [undoStackRef]);

  /**
   * Push state to undo stack with duplicate prevention
   */
  const pushToUndoStack = useCallback((snapshot) => {
    // Safety: Don't push if it's identical to the last state
    // This prevents "no-op" undo steps
    const lastUndo = undoStackRef.current[undoStackRef.current.length - 1];
    if (lastUndo && lastUndo.text === snapshot.text) {
      return;
    }

    undoStackRef.current.push(snapshot);
    
    // Enforce stack limit
    if (undoStackRef.current.length > PERFORMANCE_CONFIG.UNDO_STACK_SIZE) {
      undoStackRef.current.shift();
    }
  }, [undoStackRef]);

  /**
   * Handle undo operation
   */
  const handleUndo = useCallback(() => {
    if (!undoStackRef.current.length) return;

    const previous = undoStackRef.current.pop();
    
    // Save CURRENT state to redo stack before reverting
    const currentSnapshot = createSnapshot();
    redoStackRef.current.push(currentSnapshot);
    
    if (redoStackRef.current.length > PERFORMANCE_CONFIG.UNDO_STACK_SIZE) {
      redoStackRef.current.shift();
    }

    // Apply the previous state
    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(previous.text);
    promptOptimizer.setOptimizedPrompt(previous.text);
    applyInitialHighlightSnapshot(previous.highlight ?? null, { 
      bumpVersion: true, 
      markPersisted: false 
    });

    // Update version and UI
    setVersionCounter(previous.version || 0);
    updateUIState();

    // Reset applying flag
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    undoTimeoutRef.current = setTimeout(() => {
      isApplyingHistoryRef.current = false;
      undoTimeoutRef.current = null;
    }, PERFORMANCE_CONFIG.REF_RESET_DELAY_MS || 100);
  }, [
    createSnapshot,
    applyInitialHighlightSnapshot,
    promptOptimizer,
    setDisplayedPromptSilently,
    undoStackRef,
    redoStackRef,
    isApplyingHistoryRef,
    updateUIState,
  ]);

  /**
   * Handle redo operation
   */
  const handleRedo = useCallback(() => {
    if (!redoStackRef.current.length) return;

    const next = redoStackRef.current.pop();
    
    // Save CURRENT state to undo stack before advancing
    pushToUndoStack(createSnapshot());

    // Apply the next state
    isApplyingHistoryRef.current = true;
    setDisplayedPromptSilently(next.text);
    promptOptimizer.setOptimizedPrompt(next.text);
    applyInitialHighlightSnapshot(next.highlight ?? null, { 
      bumpVersion: true, 
      markPersisted: false 
    });

    setVersionCounter(next.version || versionCounter + 1);
    updateUIState();

    if (redoTimeoutRef.current) clearTimeout(redoTimeoutRef.current);
    redoTimeoutRef.current = setTimeout(() => {
      isApplyingHistoryRef.current = false;
      redoTimeoutRef.current = null;
    }, PERFORMANCE_CONFIG.REF_RESET_DELAY_MS || 100);
  }, [
    createSnapshot,
    pushToUndoStack,
    applyInitialHighlightSnapshot,
    promptOptimizer,
    setDisplayedPromptSilently,
    redoStackRef,
    isApplyingHistoryRef,
    updateUIState,
    versionCounter,
  ]);

  /**
   * Handle displayed prompt changes
   */
  const handleDisplayedPromptChange = useCallback(
    (newText, cursorPosition = null) => {
      const currentText = promptOptimizer.displayedPrompt;

      // Skip if applying from history
      if (isApplyingHistoryRef.current) {
        promptOptimizer.setDisplayedPrompt(newText);
        return;
      }

      // Skip if text unchanged
      if (currentText === newText) return;

      // Detect type of change for grouping logic
      const changeType = newText.length > currentText.length ? 'adding' : 'deleting';

      // DECISION: Do we start a new undo group?
      if (shouldCreateUndoPoint(currentText, newText, cursorPosition)) {
        // IMPORTANT: Save the state *BEFORE* the change (currentText)
        pushToUndoStack(createSnapshot(currentText));
        
        // Clear redo stack on new divergence
        redoStackRef.current = [];
        setCanRedo(false);
        
        // Increment version for this new editing session
        setVersionCounter(v => v + 1);
      }

      // Update tracking refs
      lastEditTimeRef.current = Date.now();
      lastCursorPositionRef.current = cursorPosition;
      pendingChangeRef.current = changeType;

      // Apply the change
      promptOptimizer.setDisplayedPrompt(newText);
      updateUIState();
    },
    [
      promptOptimizer,
      isApplyingHistoryRef,
      shouldCreateUndoPoint,
      pushToUndoStack,
      createSnapshot,
      redoStackRef,
      setCanRedo,
      updateUIState,
    ]
  );

  /**
   * Clear history stacks
   */
  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    lastEditTimeRef.current = 0;
    lastCursorPositionRef.current = null;
    pendingChangeRef.current = null;
    setVersionCounter(0);
    updateUIState();
  }, [updateUIState, undoStackRef, redoStackRef]);

  return {
    handleUndo,
    handleRedo,
    handleDisplayedPromptChange,
    clearHistory,
  };
}
