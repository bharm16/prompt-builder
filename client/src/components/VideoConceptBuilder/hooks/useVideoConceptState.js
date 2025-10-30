/**
 * Video Concept State Management Hook
 *
 * Centralizes all state management for the Video Concept Builder using useReducer.
 * This replaces the 17+ useState calls with a single, manageable state object.
 */

import { useReducer, useMemo } from 'react';
import { decomposeSubjectValue, buildComposedElements, normalizeDescriptor } from '../utils/subjectDescriptors';
import { SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';

const initialState = {
  // Core state
  mode: 'element', // 'element' | 'concept'
  concept: '',
  elements: {
    subject: '',
    subjectDescriptor1: '',
    subjectDescriptor2: '',
    subjectDescriptor3: '',
    action: '',
    location: '',
    time: '',
    mood: '',
    style: '',
    event: '',
  },

  // UI state
  ui: {
    activeElement: null,
    showTemplates: false,
    showGuidance: false,
  },

  // Suggestions state
  suggestions: {
    items: [],
    isLoading: false,
  },

  // Conflicts state
  conflicts: {
    items: [],
    isLoading: false,
  },

  // Refinements state
  refinements: {
    data: {},
    isLoading: false,
  },

  // Technical parameters state
  technicalParams: {
    data: null,
    isLoading: false,
  },

  // Compatibility scores
  compatibilityScores: {},

  // Validation score
  validationScore: null,

  // Element history
  elementHistory: [],
};

function videoConceptReducer(state, action) {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload };

    case 'SET_CONCEPT':
      return { ...state, concept: action.payload };

    case 'SET_ELEMENT': {
      const { key, value } = action.payload;
      return {
        ...state,
        elements: {
          ...state.elements,
          [key]: value,
        },
      };
    }

    case 'SET_ELEMENTS': {
      return {
        ...state,
        elements: { ...state.elements, ...action.payload },
      };
    }

    case 'APPLY_ELEMENTS': {
      const incomingElements = action.payload;
      if (!incomingElements) return state;

      let merged = { ...state.elements, ...incomingElements };

      // Handle subject decomposition
      if (incomingElements.subject !== undefined) {
        const { subject, descriptors } = decomposeSubjectValue(incomingElements.subject);
        merged.subject = subject;
        SUBJECT_DESCRIPTOR_KEYS.forEach((key, idx) => {
          merged[key] = descriptors[idx] || '';
        });
      }

      // Handle subjectDescriptors array
      if (Array.isArray(incomingElements.subjectDescriptors)) {
        SUBJECT_DESCRIPTOR_KEYS.forEach((key, idx) => {
          merged[key] =
            normalizeDescriptor(incomingElements.subjectDescriptors[idx]) || merged[key] || '';
        });
      }

      // Normalize descriptor keys
      SUBJECT_DESCRIPTOR_KEYS.forEach((key) => {
        if (incomingElements[key] === undefined && merged[key] === undefined) {
          merged[key] = '';
        } else if (incomingElements[key] !== undefined) {
          merged[key] = normalizeDescriptor(incomingElements[key]);
        }
      });

      return {
        ...state,
        elements: merged,
      };
    }

    case 'SET_ACTIVE_ELEMENT':
      return {
        ...state,
        ui: { ...state.ui, activeElement: action.payload },
      };

    case 'TOGGLE_TEMPLATES':
      return {
        ...state,
        ui: { ...state.ui, showTemplates: !state.ui.showTemplates },
      };

    case 'SET_SHOW_TEMPLATES':
      return {
        ...state,
        ui: { ...state.ui, showTemplates: action.payload },
      };

    case 'TOGGLE_GUIDANCE':
      return {
        ...state,
        ui: { ...state.ui, showGuidance: !state.ui.showGuidance },
      };

    case 'SET_SHOW_GUIDANCE':
      return {
        ...state,
        ui: { ...state.ui, showGuidance: action.payload },
      };

    case 'SUGGESTIONS_LOADING':
      return {
        ...state,
        suggestions: { ...state.suggestions, isLoading: true },
      };

    case 'SUGGESTIONS_LOADED':
      return {
        ...state,
        suggestions: { items: action.payload, isLoading: false },
      };

    case 'SUGGESTIONS_CLEAR':
      return {
        ...state,
        suggestions: { items: [], isLoading: false },
      };

    case 'CONFLICTS_LOADING':
      return {
        ...state,
        conflicts: { ...state.conflicts, isLoading: true },
      };

    case 'CONFLICTS_LOADED':
      return {
        ...state,
        conflicts: { items: action.payload, isLoading: false },
      };

    case 'CONFLICTS_CLEAR':
      return {
        ...state,
        conflicts: { items: [], isLoading: false },
      };

    case 'REFINEMENTS_LOADING':
      return {
        ...state,
        refinements: { ...state.refinements, isLoading: true },
      };

    case 'REFINEMENTS_LOADED':
      return {
        ...state,
        refinements: { data: action.payload, isLoading: false },
      };

    case 'REFINEMENTS_CLEAR':
      return {
        ...state,
        refinements: { data: {}, isLoading: false },
      };

    case 'TECHNICAL_PARAMS_LOADING':
      return {
        ...state,
        technicalParams: { ...state.technicalParams, isLoading: true },
      };

    case 'TECHNICAL_PARAMS_LOADED':
      return {
        ...state,
        technicalParams: { data: action.payload, isLoading: false },
      };

    case 'TECHNICAL_PARAMS_CLEAR':
      return {
        ...state,
        technicalParams: { data: null, isLoading: false },
      };

    case 'SET_COMPATIBILITY_SCORE':
      return {
        ...state,
        compatibilityScores: {
          ...state.compatibilityScores,
          [action.payload.key]: action.payload.score,
        },
      };

    case 'SET_VALIDATION_SCORE':
      return {
        ...state,
        validationScore: action.payload,
      };

    case 'ADD_TO_HISTORY':
      return {
        ...state,
        elementHistory: [
          ...state.elementHistory,
          {
            element: action.payload.element,
            value: action.payload.value,
            timestamp: Date.now(),
          },
        ],
      };

    case 'RESET':
      return { ...initialState, concept: state.concept };

    default:
      return state;
  }
}

/**
 * Custom hook for managing Video Concept Builder state
 * @param {string} initialConcept - Optional initial concept value
 * @returns {[Object, Function]} State and dispatch function
 */
export function useVideoConceptState(initialConcept = '') {
  const [state, dispatch] = useReducer(videoConceptReducer, {
    ...initialState,
    concept: initialConcept,
  });

  // Memoized composed elements
  const composedElements = useMemo(
    () => buildComposedElements(state.elements),
    [state.elements]
  );

  return [{ ...state, composedElements }, dispatch];
}
