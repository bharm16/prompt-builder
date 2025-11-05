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

const initialState = {
  edits: [], // Array of edit objects
  maxEdits: 50, // Limit history to prevent memory issues
};

/**
 * Edit history reducer
 * @param {Object} state - Current state
 * @param {Object} action - Action to perform
 * @returns {Object} New state
 */
function editHistoryReducer(state, action) {
  switch (action.type) {
    case 'ADD_EDIT': {
      const newEdit = {
        id: `edit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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

    default:
      return state;
  }
}

/**
 * Custom hook for tracking edit history
 * @returns {Object} Edit history state and methods
 */
export function useEditHistory() {
  const [state, dispatch] = useReducer(editHistoryReducer, initialState);

  /**
   * Add a new edit to history
   * @param {Object} edit - Edit details
   * @param {string} edit.original - Original text
   * @param {string} edit.replacement - Replacement text
   * @param {string} edit.category - Category of the edited text
   * @param {number} edit.position - Position in prompt
   * @param {number} edit.confidence - Confidence score
   */
  const addEdit = useCallback((edit) => {
    if (!edit || !edit.original || !edit.replacement) {
      return;
    }

    // Skip if original and replacement are the same
    if (edit.original.trim() === edit.replacement.trim()) {
      return;
    }

    dispatch({
      type: 'ADD_EDIT',
      payload: edit,
    });
  }, []);

  /**
   * Get recent edits
   * @param {number} count - Number of recent edits to return
   * @returns {Array} Recent edits
   */
  const getRecentEdits = useCallback((count = 10) => {
    return state.edits.slice(-count).reverse(); // Most recent first
  }, [state.edits]);

  /**
   * Clear all edit history
   */
  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  /**
   * Get edits by category
   * @param {string} category - Category to filter by
   * @returns {Array} Edits in that category
   */
  const getEditsByCategory = useCallback((category) => {
    if (!category) {
      return [];
    }

    return state.edits.filter((edit) => 
      edit.category && edit.category.toLowerCase() === category.toLowerCase()
    );
  }, [state.edits]);

  /**
   * Check if text has been edited before
   * @param {string} text - Text to check
   * @returns {boolean} True if text was previously edited
   */
  const hasEdited = useCallback((text) => {
    if (!text || typeof text !== 'string') {
      return false;
    }

    const normalized = text.trim().toLowerCase();
    return state.edits.some(
      (edit) =>
        edit.original.trim().toLowerCase() === normalized ||
        edit.replacement.trim().toLowerCase() === normalized
    );
  }, [state.edits]);

  /**
   * Get edit for specific text (if it exists)
   * @param {string} text - Text to find edit for
   * @returns {Object|null} Edit object or null
   */
  const getEditForText = useCallback((text) => {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const normalized = text.trim().toLowerCase();
    return state.edits.find(
      (edit) =>
        edit.original.trim().toLowerCase() === normalized ||
        edit.replacement.trim().toLowerCase() === normalized
    ) || null;
  }, [state.edits]);

  /**
   * Remove a specific edit
   * @param {string} editId - ID of edit to remove
   */
  const removeEdit = useCallback((editId) => {
    dispatch({ type: 'REMOVE_EDIT', payload: editId });
  }, []);

  /**
   * Get edits within time range
   * @param {number} minutes - Minutes to look back
   * @returns {Array} Edits within time range
   */
  const getRecentEditsByTime = useCallback((minutes = 10) => {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return state.edits.filter((edit) => edit.timestamp >= cutoff).reverse();
  }, [state.edits]);

  /**
   * Get edit summary for API transmission
   * Simplified format for backend processing
   * @param {number} count - Number of recent edits to include
   * @returns {Array} Simplified edit array
   */
  const getEditSummary = useCallback((count = 10) => {
    return state.edits.slice(-count).map((edit) => ({
      original: edit.original,
      replacement: edit.replacement,
      category: edit.category,
      timestamp: edit.timestamp,
      minutesAgo: Math.floor((Date.now() - edit.timestamp) / 60000),
    }));
  }, [state.edits]);

  // Memoized computed values
  const editCount = useMemo(() => state.edits.length, [state.edits]);
  const hasEdits = useMemo(() => state.edits.length > 0, [state.edits]);

  // Memoized category counts
  const editsByCategory = useMemo(() => {
    const counts = {};
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
  };
}

