/**
 * Request/Response Types
 *
 * Types for API requests and responses
 */

export interface PromptOptimizationRequest {
  prompt: string;
  mode?: string;
  context?: {
    specificAspects?: string;
    backgroundLevel?: string;
    intendedUse?: string;
  } | null;
  brainstormContext?: {
    elements?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    version?: string;
    createdAt?: number;
  } | null;
}

export interface SuggestionRequest {
  highlightedText: string;
  contextBefore?: string;
  contextAfter?: string;
  fullPrompt: string;
  originalUserPrompt?: string;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  highlightedPhrase?: string | null;
  brainstormContext?: {
    version?: string;
    createdAt?: number;
    elements?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  } | null;
  allLabeledSpans?: Array<{
    text: string;
    role: string;
    category?: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  nearbySpans?: Array<{
    text: string;
    role: string;
    category?: string;
    confidence?: number;
    distance: number;
    position: 'before' | 'after';
    start?: number;
    end?: number;
  }>;
  editHistory?: Array<{
    original: string;
    replacement: string;
    category?: string | null;
    timestamp?: number;
  }>;
}

export interface CustomSuggestionRequest {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
  contextBefore?: string;
  contextAfter?: string;
  metadata?: Record<string, unknown> | null;
}

export interface SceneChangeRequest {
  changedField: string;
  newValue: string;
  oldValue?: string | null;
  fullPrompt: string;
  affectedFields?: Record<string, unknown>;
  sectionHeading?: string | null;
  sectionContext?: string | null;
}

export type ElementType =
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

export interface CreativeSuggestionRequest {
  elementType: ElementType;
  currentValue?: string;
  context?: string | Record<string, unknown>;
  concept?: string;
}

export interface VideoValidationRequest {
  elementType?: ElementType;
  value?: string;
  elements: Record<string, unknown>;
}

export interface CompleteSceneRequest {
  existingElements: Record<string, unknown>;
  concept?: string;
  smartDefaultsFor?: ElementType | 'technical';
}

export interface VariationsRequest {
  elements: Record<string, unknown>;
  concept?: string;
}

export interface ParseConceptRequest {
  concept: string;
}

export interface SaveTemplateRequest {
  name: string;
  elements: Record<string, unknown>;
  concept?: string;
  userId?: string;
}

export interface TemplateRecommendationsRequest {
  userId?: string;
  currentElements?: Record<string, unknown>;
}

export interface RecordUserChoiceRequest {
  elementType: string;
  chosen: string;
  rejected?: string[];
  userId?: string;
}

export interface AlternativePhrasingsRequest {
  elementType: string;
  value: string;
}
