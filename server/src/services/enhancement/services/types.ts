/**
 * Types for enhancement services
 * Shared type definitions used across enhancement service modules
 */

import type { AIModelService } from '../../ai-model/AIModelService.js';
import type { VideoPromptService } from '../../video-prompt-analysis/index.js';

/**
 * Suggestion object structure
 */
export interface Suggestion {
  text: string;
  explanation?: string;
  category?: string;
  confidence?: number;
  [key: string]: unknown;
}

/**
 * Sanitization context for suggestions
 */
export interface SanitizationContext {
  highlightedText?: string;
  isPlaceholder?: boolean;
  isVideoPrompt?: boolean;
  videoConstraints?: VideoConstraints;
}

/**
 * Video prompt constraints
 */
export interface VideoConstraints {
  minWords?: number;
  maxWords?: number;
  maxSentences?: number;
  mode?: 'micro' | 'standard' | 'narrative';
  disallowTerminalPunctuation?: boolean;
  formRequirement?: string;
  focusGuidance?: string[];
  extraRequirements?: string[];
}

/**
 * Validation parameters
 */
export interface ValidationParams {
  highlightedText: string;
  highlightedCategory?: string;
  highlightedCategoryConfidence?: number;
}

/**
 * Category alignment result
 */
export interface CategoryAlignmentResult {
  suggestions: Suggestion[];
  fallbackApplied: boolean;
  context: {
    baseCategory?: string;
    originalSuggestionsRejected?: number;
    reason?: string;
  };
}

/**
 * Brainstorm context structure
 */
export interface BrainstormContext {
  elements?: Record<string, string>;
  metadata?: {
    format?: string;
    technicalParams?: Record<string, unknown>;
    validationScore?: number;
  };
}

/**
 * Brainstorm signature (normalized for caching)
 */
export interface BrainstormSignature {
  elements?: Record<string, string>;
  metadata?: {
    format?: string;
    technicalParams?: Record<string, unknown>;
    validationScore?: number;
  };
}

/**
 * Creative intent analysis
 */
export interface CreativeIntent {
  primaryIntent: string | null;
  supportingThemes: string[];
  narrativeDirection: string | null;
  emotionalTone: string | null;
}

/**
 * Style conflict detection
 */
export interface StyleConflict {
  type: string;
  description: string;
  suggestion: string;
}

/**
 * Complementary element suggestion
 */
export interface ComplementaryElement {
  element: string;
  reason: string;
}

/**
 * Missing element suggestion
 */
export interface MissingElement {
  category: string;
  displayLabel: string;
  reason: string;
}

/**
 * Prompt building parameters
 */
export interface PromptBuildParams {
  highlightedText?: string;
  contextBefore?: string;
  contextAfter?: string;
  fullPrompt?: string;
  brainstormContext?: BrainstormContext | null;
  editHistory?: Array<{ original?: string }>;
  modelTarget?: string | null;
  isVideoPrompt?: boolean;
  phraseRole?: string | null;
  highlightedCategory?: string | null;
  promptSection?: string | null;
  videoConstraints?: VideoConstraints | null;
  highlightWordCount?: number | null;
  mode?: 'rewrite' | 'placeholder';
  isPlaceholder?: boolean;
  customRequest?: string;
}

/**
 * Custom prompt parameters
 */
export interface CustomPromptParams {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
  isVideoPrompt: boolean;
}

/**
 * Shared context for prompt building
 */
export interface SharedPromptContext {
  slotLabel: string;
  inlineContext: string;
  prefix: string;
  suffix: string;
  promptPreview: string;
  constraintLine: string;
  modelLine: string;
  sectionLine: string;
  guidance: string;
  replacementInstruction: string;
  highlightedText: string;
  highlightWordCount?: number | null;
  mode: 'rewrite' | 'placeholder';
}

/**
 * Contrastive decoding context
 */
export interface ContrastiveDecodingContext {
  systemPrompt: string;
  schema: Record<string, unknown>;
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  highlightedText?: string;
}

/**
 * Diversity metrics
 */
export interface DiversityMetrics {
  avgSimilarity: number;
  minSimilarity: number;
  maxSimilarity: number;
  pairCount?: number;
}

/**
 * Fallback regeneration parameters
 */
export interface FallbackRegenerationParams {
  sanitizedSuggestions: Suggestion[];
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  videoConstraints?: VideoConstraints;
  regenerationDetails: {
    highlightWordCount?: number;
    phraseRole?: string;
  };
  requestParams: PromptBuildParams;
  aiService: AIModelService;
  schema: Record<string, unknown>;
  temperature: number;
}

/**
 * Fallback regeneration result
 */
export interface FallbackRegenerationResult {
  suggestions: Suggestion[];
  constraints?: VideoConstraints;
  usedFallback: boolean;
  sourceCount: number;
  rawCount?: number;
}

/**
 * Descriptor detection result
 */
export interface DescriptorDetection {
  confidence: number;
  category?: string;
}

/**
 * Descriptor fallback result
 */
export interface DescriptorFallbackResult {
  suggestions: Suggestion[];
  usedFallback: boolean;
  isDescriptorPhrase: boolean;
  descriptorCategory?: string;
}

/**
 * Grouped suggestions by category
 */
export interface GroupedSuggestions {
  category: string;
  suggestions: Suggestion[];
}

/**
 * Final result structure
 */
export interface EnhancementResult {
  suggestions: Suggestion[] | GroupedSuggestions[];
  isPlaceholder: boolean;
  hasCategories: boolean;
  phraseRole: string | null;
  appliedConstraintMode: string | null;
  fallbackApplied: boolean;
  appliedVideoConstraints?: VideoConstraints;
  noSuggestionsReason?: string;
}

/**
 * Service dependencies
 */
export interface VideoService {
  countWords(text: string): number;
  getVideoFallbackConstraints(
    currentConstraints: VideoConstraints | undefined,
    details: Record<string, unknown>,
    attemptedModes: Set<string>
  ): VideoConstraints | null;
}

export type AIService = AIModelService;

