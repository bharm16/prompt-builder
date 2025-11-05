/**
 * useWizardState Hook
 * 
 * Centralized state management using useReducer for all wizard state.
 * Replaces 9 separate useState calls with a single reducer.
 */

import { useReducer, useCallback } from 'react';
import { INITIAL_FORM_DATA } from '../config/constants';

// Action Types
const ACTIONS = {
  // Entry page
  SET_SHOW_ENTRY_PAGE: 'SET_SHOW_ENTRY_PAGE',
  
  // Navigation
  SET_CURRENT_STEP: 'SET_CURRENT_STEP',
  SET_MOBILE_FIELD_INDEX: 'SET_MOBILE_FIELD_INDEX',
  
  // Form data
  SET_FIELD_VALUE: 'SET_FIELD_VALUE',
  SET_FORM_DATA: 'SET_FORM_DATA',
  RESET_FORM_DATA: 'RESET_FORM_DATA',
  
  // Suggestions
  SET_SUGGESTIONS: 'SET_SUGGESTIONS',
  SET_LOADING_SUGGESTIONS: 'SET_LOADING_SUGGESTIONS',
  
  // Validation
  SET_VALIDATION_ERROR: 'SET_VALIDATION_ERROR',
  CLEAR_VALIDATION_ERROR: 'CLEAR_VALIDATION_ERROR',
  SET_VALIDATION_ERRORS: 'SET_VALIDATION_ERRORS',
  SET_COMPLETED_STEPS: 'SET_COMPLETED_STEPS',
  ADD_COMPLETED_STEP: 'ADD_COMPLETED_STEP',
};

// Initial State
const initialState = {
  // Entry page
  showEntryPage: true,
  
  // Navigation
  currentStep: 0,
  currentMobileFieldIndex: 0,
  
  // Form data
  formData: INITIAL_FORM_DATA,
  
  // Suggestions
  suggestions: {},
  isLoadingSuggestions: {},
  
  // Validation
  validationErrors: {},
  completedSteps: [],
};

// Reducer
function wizardReducer(state, action) {
  switch (action.type) {
    // Entry page
    case ACTIONS.SET_SHOW_ENTRY_PAGE:
      return { ...state, showEntryPage: action.payload };
    
    // Navigation
    case ACTIONS.SET_CURRENT_STEP:
      return { ...state, currentStep: action.payload };
    
    case ACTIONS.SET_MOBILE_FIELD_INDEX:
      return { ...state, currentMobileFieldIndex: action.payload };
    
    // Form data
    case ACTIONS.SET_FIELD_VALUE: {
      const { fieldName, value } = action.payload;
      
      // Handle nested fields (e.g., "camera.angle")
      if (fieldName.includes('.')) {
        const [category, field] = fieldName.split('.');
        return {
          ...state,
          formData: {
            ...state.formData,
            [category]: {
              ...state.formData[category],
              [field]: value,
            },
          },
        };
      }
      
      return {
        ...state,
        formData: {
          ...state.formData,
          [fieldName]: value,
        },
      };
    }
    
    case ACTIONS.SET_FORM_DATA:
      return { ...state, formData: action.payload };
    
    case ACTIONS.RESET_FORM_DATA:
      return { ...state, formData: INITIAL_FORM_DATA };
    
    // Suggestions
    case ACTIONS.SET_SUGGESTIONS:
      return {
        ...state,
        suggestions: {
          ...state.suggestions,
          [action.payload.fieldName]: action.payload.suggestions,
        },
      };
    
    case ACTIONS.SET_LOADING_SUGGESTIONS:
      return {
        ...state,
        isLoadingSuggestions: {
          ...state.isLoadingSuggestions,
          [action.payload.fieldName]: action.payload.isLoading,
        },
      };
    
    // Validation
    case ACTIONS.SET_VALIDATION_ERROR:
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.payload.fieldName]: action.payload.error,
        },
      };
    
    case ACTIONS.CLEAR_VALIDATION_ERROR: {
      const { [action.payload.fieldName]: removed, ...remaining } = state.validationErrors;
      return {
        ...state,
        validationErrors: remaining,
      };
    }
    
    case ACTIONS.SET_VALIDATION_ERRORS:
      return { ...state, validationErrors: action.payload };
    
    case ACTIONS.SET_COMPLETED_STEPS:
      return { ...state, completedSteps: action.payload };
    
    case ACTIONS.ADD_COMPLETED_STEP:
      if (state.completedSteps.includes(action.payload)) {
        return state;
      }
      return {
        ...state,
        completedSteps: [...state.completedSteps, action.payload],
      };
    
    default:
      return state;
  }
}

/**
 * useWizardState Hook
 * 
 * Provides centralized state management for the wizard.
 */
export function useWizardState(initialFormData = INITIAL_FORM_DATA) {
  const [state, dispatch] = useReducer(wizardReducer, {
    ...initialState,
    formData: initialFormData,
  });

  // Action creators (memoized)
  const actions = {
    // Entry page
    setShowEntryPage: useCallback((show) => {
      dispatch({ type: ACTIONS.SET_SHOW_ENTRY_PAGE, payload: show });
    }, []),
    
    // Navigation
    setCurrentStep: useCallback((step) => {
      dispatch({ type: ACTIONS.SET_CURRENT_STEP, payload: step });
    }, []),
    
    setMobileFieldIndex: useCallback((index) => {
      dispatch({ type: ACTIONS.SET_MOBILE_FIELD_INDEX, payload: index });
    }, []),
    
    // Form data
    setFieldValue: useCallback((fieldName, value) => {
      dispatch({ type: ACTIONS.SET_FIELD_VALUE, payload: { fieldName, value } });
      // Auto-clear validation error for this field
      dispatch({ type: ACTIONS.CLEAR_VALIDATION_ERROR, payload: { fieldName } });
    }, []),
    
    setFormData: useCallback((formData) => {
      dispatch({ type: ACTIONS.SET_FORM_DATA, payload: formData });
    }, []),
    
    resetFormData: useCallback(() => {
      dispatch({ type: ACTIONS.RESET_FORM_DATA });
    }, []),
    
    // Suggestions
    setSuggestions: useCallback((fieldName, suggestions) => {
      dispatch({ type: ACTIONS.SET_SUGGESTIONS, payload: { fieldName, suggestions } });
    }, []),
    
    setLoadingSuggestions: useCallback((fieldName, isLoading) => {
      dispatch({ type: ACTIONS.SET_LOADING_SUGGESTIONS, payload: { fieldName, isLoading } });
    }, []),
    
    // Validation
    setValidationError: useCallback((fieldName, error) => {
      dispatch({ type: ACTIONS.SET_VALIDATION_ERROR, payload: { fieldName, error } });
    }, []),
    
    clearValidationError: useCallback((fieldName) => {
      dispatch({ type: ACTIONS.CLEAR_VALIDATION_ERROR, payload: { fieldName } });
    }, []),
    
    setValidationErrors: useCallback((errors) => {
      dispatch({ type: ACTIONS.SET_VALIDATION_ERRORS, payload: errors });
    }, []),
    
    setCompletedSteps: useCallback((steps) => {
      dispatch({ type: ACTIONS.SET_COMPLETED_STEPS, payload: steps });
    }, []),
    
    addCompletedStep: useCallback((step) => {
      dispatch({ type: ACTIONS.ADD_COMPLETED_STEP, payload: step });
    }, []),
  };

  return { state, actions };
}

