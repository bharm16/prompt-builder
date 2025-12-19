/**
 * Type definitions for Video Concept Builder hooks
 * Following STYLE_RULES.md: No magic strings, discriminated unions for actions
 */

export type VideoConceptMode = 'element' | 'concept';

export type ElementKey =
  | 'subject'
  | 'subjectDescriptor1'
  | 'subjectDescriptor2'
  | 'subjectDescriptor3'
  | 'action'
  | 'location'
  | 'time'
  | 'mood'
  | 'style'
  | 'event';

export interface Elements {
  subject: string;
  subjectDescriptor1: string;
  subjectDescriptor2: string;
  subjectDescriptor3: string;
  action: string;
  location: string;
  time: string;
  mood: string;
  style: string;
  event: string;
  [key: string]: string; // Index signature for dynamic access
}

export interface UIState {
  activeElement: ElementKey | null;
  showTemplates: boolean;
  showGuidance: boolean;
}

export interface SuggestionsState {
  items: string[];
  isLoading: boolean;
}

export interface ConflictItem {
  message: string;
  resolution?: string;
  suggestion?: string;
  severity?: string;
}

export interface ConflictsState {
  items: ConflictItem[];
  isLoading: boolean;
}

export interface RefinementsState {
  data: Record<string, string[]>;
  isLoading: boolean;
}

export interface TechnicalParamsState {
  data: Record<string, unknown> | null;
  isLoading: boolean;
}

export interface ElementHistoryEntry {
  element: ElementKey;
  value: string;
  timestamp: number;
}

export interface VideoConceptState {
  mode: VideoConceptMode;
  concept: string;
  elements: Elements;
  ui: UIState;
  suggestions: SuggestionsState;
  conflicts: ConflictsState;
  refinements: RefinementsState;
  technicalParams: TechnicalParamsState;
  compatibilityScores: Record<string, number>;
  validationScore: number | null;
  elementHistory: ElementHistoryEntry[];
  composedElements?: Record<string, string>;
}

// Discriminated union for reducer actions (per STYLE_RULES.md)
export type VideoConceptAction =
  | { type: 'SET_MODE'; payload: VideoConceptMode }
  | { type: 'SET_CONCEPT'; payload: string }
  | { type: 'SET_ELEMENT'; payload: { key: ElementKey; value: string } }
  | { type: 'SET_ELEMENTS'; payload: Partial<Elements> }
  | {
      type: 'APPLY_ELEMENTS';
      payload: Partial<Elements> & {
        subjectDescriptors?: string[];
      };
    }
  | { type: 'SET_ACTIVE_ELEMENT'; payload: ElementKey | null }
  | { type: 'TOGGLE_TEMPLATES' }
  | { type: 'SET_SHOW_TEMPLATES'; payload: boolean }
  | { type: 'TOGGLE_GUIDANCE' }
  | { type: 'SET_SHOW_GUIDANCE'; payload: boolean }
  | { type: 'SUGGESTIONS_LOADING' }
  | { type: 'SUGGESTIONS_LOADED'; payload: string[] }
  | { type: 'SUGGESTIONS_CLEAR' }
  | { type: 'CONFLICTS_LOADING' }
  | { type: 'CONFLICTS_LOADED'; payload: string[] }
  | { type: 'CONFLICTS_CLEAR' }
  | { type: 'REFINEMENTS_LOADING' }
  | { type: 'REFINEMENTS_LOADED'; payload: Record<string, string[]> }
  | { type: 'REFINEMENTS_CLEAR' }
  | { type: 'TECHNICAL_PARAMS_LOADING' }
  | { type: 'TECHNICAL_PARAMS_LOADED'; payload: Record<string, unknown> }
  | { type: 'TECHNICAL_PARAMS_CLEAR' }
  | {
      type: 'SET_COMPATIBILITY_SCORE';
      payload: { key: string; score: number };
    }
  | { type: 'SET_VALIDATION_SCORE'; payload: number | null }
  | {
      type: 'ADD_TO_HISTORY';
      payload: { element: ElementKey; value: string };
    }
  | { type: 'RESET' };

