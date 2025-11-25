/**
 * Edit History Tracking Hook
 *
 * Tracks user edits during the prompt optimization session to maintain
 * creative coherence and consistency across suggestions.
 *
 * Pattern: useReducer-based state management (like VideoConceptBuilder)
 * Storage: Session-only (resets on page refresh)
 */

import { useReducer, useCallback, useMemo } from 'react';

interface Edit {
  id: string;
  original: string;
  replacement: string;
  category: string | null;
  timestamp: number;
  position: number | null;
  confidence: number | null;
}

interface PromptState {
  prompt: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

interface EditHistoryState {
  edits: Edit[];
  maxEdits: number;
  promptHistory: PromptState[];
  historyIndex: number;
  maxHistorySize: number;
}

type EditHistoryAction =
  | { type: 'ADD_EDIT'; payload: EditPayload }
  | { type: 'CLEAR_HISTORY' }
  | { type: 'REMOVE_EDIT'; payload: string }
  | { type: 'SAVE_STATE'; payload: { prompt: string; metadata: Record<string, unknown> } }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_HISTORY_STATES' };

const initialState: EditHistoryState = {
  edits: [],
  maxEdits: 50,
  promptHistory: [],
  historyIndex: -1,
  maxHistorySize: 100,
};

/**
 * Edit history reducer
 */
function editHistoryReducer(
  state: EditHistoryState,
  action: EditHistoryAction
): EditHistoryState {
  switch (action.type) {
    case 'ADD_EDIT': {
      const newEdit: Edit = {
        id: `edit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        original: action.payload.original,
        replacement: action.payload.replacement,
        category: action.payload.category || null,
        timestamp: Date.now(),
        position: action.payload.position || null,
        confidence: action.payload.confidence || null,
      };

      // Keep only the most recent edits (FIFO)
      const updatedEdits = [...state.edits, newEdit];
      if (updatedEdits.length > state.maxEdits) {
        updatedEdits.shift(); // Remove oldest
      }

      return {
        ...state,
        edits: updatedEdits,
      };
    }

    case 'CLEAR_HISTORY':
      return {
        ...state,
        edits: [],
      };

    case 'REMOVE_EDIT':
      return {
        ...state,
        edits: state.edits.filter((edit) => edit.id !== action.payload),
      };

    case 'SAVE_STATE': {
      const { prompt, metadata } = action.payload;

      // If we're in the middle of history (user went back), discard future states
      const currentHistory =
        state.historyIndex >= 0
          ? state.promptHistory.slice(0, state.historyIndex + 1)
          : state.promptHistory;

      // Add new state
      const newHistory = [
        ...currentHistory,
        {
          prompt,
          metadata,
          timestamp: Date.now(),
        },
      ];

      // Limit history size
      const trimmedHistory =
        newHistory.length > state.maxHistorySize
          ? newHistory.slice(-state.maxHistorySize)
          : newHistory;

      return {
        ...state,
        promptHistory: trimmedHistory,
        historyIndex: trimmedHistory.length - 1,
      };
    }

    case 'UNDO': {
      if (state.historyIndex <= 0) {
        return state; // Can't undo
      }

      return {
        ...state,
        historyIndex: state.historyIndex - 1,
      };
    }

    case 'REDO': {
      if (state.historyIndex >= state.promptHistory.length - 1) {
        return state; // Can't redo
      }

      return {
        ...state,
        historyIndex: state.historyIndex + 1,
      };
    }

    case 'CLEAR_HISTORY_STATES': {
      return {
        ...state,
        promptHistory: [],
        historyIndex: -1,
      };
    }

    default:
      return state;
  }
}

interface AddEditParams {
  original: string;
  replacement: string;
  category?: string | null;
  position?: number | null;
  confidence?: number | null;
}

type EditPayload = Omit<Edit, 'id' | 'timestamp'>;

/**
 * Custom hook for tracking edit history
 */
export function useEditHistory() {
  const [state, dispatch] = useReducer(editHistoryReducer, initialState);

  /**
   * Add a new edit to history
   */
  const addEdit = useCallback((edit: AddEditParams) => {
    if (!edit || !edit.original || !edit.replacement) {
      return;
    }

    // Skip if original and replacement are the same
    if (edit.original.trim() === edit.replacement.trim()) {
      return;
    }

    const payload: EditPayload = {
      original: edit.original,
      replacement: edit.replacement,
      category: edit.category ?? null,
      position: edit.position ?? null,
      confidence: edit.confidence ?? null,
    };

    dispatch({
      type: 'ADD_EDIT',
      payload,
    });
  }, []);

  /**
   * Get recent edits
   */
  const getRecentEdits = useCallback(
    (count: number = 10): Edit[] => {
      return state.edits.slice(-count).reverse(); // Most recent first
    },
    [state.edits]
  );

  /**
   * Clear all edit history
   */
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  /**
   * Get edits by category
   */
  const getEditsByCategory = useCallback(
    (category: string): Edit[] => {
      if (!category) {
        return [];
      }

      return state.edits.filter(
        (edit) =>
          edit.category &&
          edit.category.toLowerCase() === category.toLowerCase()
      );
    },
    [state.edits]
  );

  /**
   * Check if text has been edited before
   */
  const hasEdited = useCallback(
    (text: string): boolean => {
      if (!text || typeof text !== 'string') {
        return false;
      }

      const normalized = text.trim().toLowerCase();
      return state.edits.some(
        (edit) =>
          edit.original.trim().toLowerCase() === normalized ||
          edit.replacement.trim().toLowerCase() === normalized
      );
    },
    [state.edits]
  );

  /**
   * Get edit for specific text (if it exists)
   */
  const getEditForText = useCallback(
    (text: string): Edit | null => {
      if (!text || typeof text !== 'string') {
        return null;
      }

      const normalized = text.trim().toLowerCase();
      return (
        state.edits.find(
          (edit) =>
            edit.original.trim().toLowerCase() === normalized ||
            edit.replacement.trim().toLowerCase() === normalized
        ) || null
      );
    },
    [state.edits]
  );

  /**
   * Remove a specific edit
   */
  const removeEdit = useCallback((editId: string) => {
    dispatch({ type: 'REMOVE_EDIT', payload: editId });
  }, []);

  /**
   * Get edits within time range
   */
  const getRecentEditsByTime = useCallback(
    (minutes: number = 10): Edit[] => {
      const cutoff = Date.now() - minutes * 60 * 1000;
      return state.edits
        .filter((edit) => edit.timestamp >= cutoff)
        .reverse();
    },
    [state.edits]
  );

  /**
   * Get edit summary for API transmission
   * Simplified format for backend processing
   */
  const getEditSummary = useCallback(
    (count: number = 10): Array<{
      original: string;
      replacement: string;
      category: string | null;
      timestamp: number;
      minutesAgo: number;
    }> => {
      return state.edits.slice(-count).map((edit) => ({
        original: edit.original,
        replacement: edit.replacement,
        category: edit.category,
        timestamp: edit.timestamp,
        minutesAgo: Math.floor((Date.now() - edit.timestamp) / 60000),
      }));
    },
    [state.edits]
  );

  // ============ Undo/Redo Methods ============

  /**
   * Save current prompt state to history
   */
  const saveState = useCallback(
    (prompt: string, metadata: Record<string, unknown> = {}) => {
      if (!prompt || typeof prompt !== 'string') {
        return;
      }

      dispatch({
        type: 'SAVE_STATE',
        payload: { prompt, metadata },
      });
    },
    []
  );

  /**
   * Undo last change
   */
  const undo = useCallback((): PromptState | null => {
    if (state.historyIndex <= 0) {
      return null;
    }

    dispatch({ type: 'UNDO' });
    const previousState = state.promptHistory[state.historyIndex - 1];
    return previousState ?? null;
  }, [state.historyIndex, state.promptHistory]);

  /**
   * Redo last undone change
   */
  const redo = useCallback((): PromptState | null => {
    if (state.historyIndex >= state.promptHistory.length - 1) {
      return null;
    }

    dispatch({ type: 'REDO' });
    const nextState = state.promptHistory[state.historyIndex + 1];
    return nextState ?? null;
  }, [state.historyIndex, state.promptHistory]);

  /**
   * Check if undo is available
   */
  const canUndo = useMemo(() => {
    return state.historyIndex > 0;
  }, [state.historyIndex]);

  /**
   * Check if redo is available
   */
  const canRedo = useMemo(() => {
    return (
      state.historyIndex >= 0 &&
      state.historyIndex < state.promptHistory.length - 1
    );
  }, [state.historyIndex, state.promptHistory.length]);

  /**
   * Get preview of what undo would restore
   */
  const getUndoPreview = useCallback((): PromptState | null => {
    if (!canUndo) {
      return null;
    }
    return state.promptHistory[state.historyIndex - 1] ?? null;
  }, [canUndo, state.historyIndex, state.promptHistory]);

  /**
   * Get preview of what redo would restore
   */
  const getRedoPreview = useCallback((): PromptState | null => {
    if (!canRedo) {
      return null;
    }
    return state.promptHistory[state.historyIndex + 1] ?? null;
  }, [canRedo, state.historyIndex, state.promptHistory]);

  /**
   * Get current state from history
   */
  const getCurrentState = useCallback((): PromptState | null => {
    if (
      state.historyIndex < 0 ||
      state.historyIndex >= state.promptHistory.length
    ) {
      return null;
    }
    return state.promptHistory[state.historyIndex] ?? null;
  }, [state.historyIndex, state.promptHistory]);

  /**
   * Clear prompt history (keeps edit history)
   */
  const clearHistoryStates = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY_STATES' });
  }, []);

  // Memoized computed values
  const editCount = useMemo(() => state.edits.length, [state.edits]);
  const hasEdits = useMemo(() => state.edits.length > 0, [state.edits]);

  // Memoized category counts
  const editsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    state.edits.forEach((edit) => {
      const category = edit.category || 'uncategorized';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [state.edits]);

  return {
    // State
    edits: state.edits,
    editCount,
    hasEdits,
    editsByCategory,

    // Methods
    addEdit,
    getRecentEdits,
    clearHistory,
    getEditsByCategory,
    hasEdited,
    getEditForText,
    removeEdit,
    getRecentEditsByTime,
    getEditSummary,

    // Undo/Redo state and methods
    promptHistory: state.promptHistory,
    historyIndex: state.historyIndex,
    canUndo,
    canRedo,
    saveState,
    undo,
    redo,
    getUndoPreview,
    getRedoPreview,
    getCurrentState,
    clearHistoryStates,
  };
}

