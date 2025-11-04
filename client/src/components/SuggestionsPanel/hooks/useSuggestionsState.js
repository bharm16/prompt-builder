/**
 * useSuggestionsState Hook
 *
 * State management for SuggestionsPanel using useReducer pattern.
 * Handles category processing, filtering, and active category selection.
 * Following VideoConceptBuilder pattern: hooks/useVideoConceptState.js
 */

import { useReducer, useEffect, useMemo } from 'react';

// ===========================
// ACTION TYPES
// ===========================

const ACTIONS = {
  SET_SUGGESTIONS: 'SET_SUGGESTIONS',
  SET_ACTIVE_CATEGORY: 'SET_ACTIVE_CATEGORY',
  SET_LOADING: 'SET_LOADING',
};

// ===========================
// REDUCER
// ===========================

function suggestionsReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_SUGGESTIONS:
      return {
        ...state,
        suggestions: action.payload,
      };

    case ACTIONS.SET_ACTIVE_CATEGORY:
      return {
        ...state,
        activeCategory: action.payload,
      };

    case ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
      };

    default:
      return state;
  }
}

// ===========================
// HOOK
// ===========================

/**
 * Custom hook for suggestions state management
 *
 * @param {Array} suggestions - Raw suggestions array
 * @param {string} initialCategory - Initial category to select
 * @returns {Object} State and utilities
 */
export function useSuggestionsState(suggestions = [], initialCategory = null) {
  const initialState = {
    suggestions,
    activeCategory: null,
    isLoading: false,
  };

  const [state, dispatch] = useReducer(suggestionsReducer, initialState);

  // ===========================
  // CATEGORY PROCESSING
  // ===========================

  const hasCategories = useMemo(() => {
    return suggestions?.length > 0 && suggestions[0]?.category !== undefined;
  }, [suggestions]);

  const isGroupedFormat = useMemo(() => {
    return suggestions?.length > 0 && suggestions[0]?.suggestions !== undefined;
  }, [suggestions]);

  const categories = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];

    // Already in grouped format
    if (isGroupedFormat) {
      return suggestions;
    }

    // Has category property - group by category
    if (hasCategories) {
      const grouped = {};
      suggestions.forEach((suggestion) => {
        const cat = suggestion.category || 'Other';
        if (!grouped[cat]) {
          grouped[cat] = { category: cat, suggestions: [] };
        }
        grouped[cat].suggestions.push(suggestion);
      });
      return Object.values(grouped);
    }

    // No categories - create single group
    return [{ category: 'Suggestions', suggestions }];
  }, [suggestions, hasCategories, isGroupedFormat]);

  // ===========================
  // CATEGORY SELECTION
  // ===========================

  useEffect(() => {
    if (categories.length === 0) {
      if (state.activeCategory) {
        dispatch({ type: ACTIONS.SET_ACTIVE_CATEGORY, payload: null });
      }
      return;
    }

    const preferredCategory =
      initialCategory && categories.some((cat) => cat.category === initialCategory)
        ? initialCategory
        : categories[0].category;

    if (!state.activeCategory || !categories.some((cat) => cat.category === state.activeCategory)) {
      dispatch({ type: ACTIONS.SET_ACTIVE_CATEGORY, payload: preferredCategory });
    }
  }, [categories, state.activeCategory, initialCategory]);

  // ===========================
  // CURRENT SUGGESTIONS FILTER
  // ===========================

  const currentSuggestions = useMemo(() => {
    if (!categories || categories.length === 0) return [];
    if (!state.activeCategory) return categories[0]?.suggestions || [];

    const current = categories.find((cat) => cat.category === state.activeCategory);
    return current?.suggestions || categories[0]?.suggestions || [];
  }, [categories, state.activeCategory]);

  // ===========================
  // RETURN STATE & UTILITIES
  // ===========================

  return {
    categories,
    activeCategory: state.activeCategory,
    currentSuggestions,
    isLoading: state.isLoading,
    hasCategories,
    isGroupedFormat,
    dispatch,
    actions: ACTIONS,
  };
}
