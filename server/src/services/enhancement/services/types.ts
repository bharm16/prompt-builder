/**
 * Types for enhancement services
 * Shared type definitions used across enhancement service modules
 */

import type { AIModelService } from '@services/ai-model/AIModelService';
import type { VideoPromptService } from '@services/video-prompt-analysis/index';
import type { PromptMode } from '../constants.js';
import type { ImageObservation } from '@services/image-observation/types';
import type { I2VConstraintMode, LockMap } from '@services/prompt-optimization/types/i2v';

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

export interface LabeledSpan {
  text: string;
  role: string;
  category?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

export interface NearbySpan {
  text: string;
  role: string;
  category?: string;
  confidence?: number;
  distance: number;
  position: 'before' | 'after';
  start?: number;
  end?: number;
}

export interface EditHistoryEntry {
  original?: string;
  replacement?: string;
  category?: string | null;
  timestamp?: number;
}

/**
 * Sanitization context for suggestions
 */
export interface SanitizationContext {
  highlightedText?: string;
  isPlaceholder?: boolean;
  isVideoPrompt?: boolean;
  videoConstraints?: VideoConstraints;
  highlightedCategory?: string | null;
  lockedSpanCategories?: string[];
}

/**
 * Video prompt constraints
 */
export interface VideoConstraints {
  minWords?: number;
  maxWords?: number;
  maxSentences?: number;
  mode?: string;
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
  originalUserPrompt?: string;
  brainstormContext?: BrainstormContext | null;
  editHistory?: EditHistoryEntry[];
  modelTarget?: string | null;
  isVideoPrompt?: boolean;
  phraseRole?: string | null;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  promptSection?: string | null;
  videoConstraints?: VideoConstraints | null;
  highlightWordCount?: number | null;
  mode?: 'rewrite' | 'placeholder';
  isPlaceholder?: boolean;
  customRequest?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
  focusGuidance?: string[];
}

/**
 * Custom prompt parameters
 */
export interface CustomPromptParams {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
  isVideoPrompt: boolean;
  contextBefore?: string;
  contextAfter?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Result from building a prompt, including provider-specific options
 */
export interface PromptBuildResult {
  systemPrompt: string;
  developerMessage?: string;
  userMessage?: string;
  useStrictSchema?: boolean;
  provider: 'openai' | 'groq' | 'qwen';
  reasoningEffort?: 'none' | 'default';
}

/**
 * Shared context for prompt building
 * SIMPLIFIED for 8B models - only essential fields
 */
export interface SharedPromptContext {
  highlightedText: string;          // The text being replaced
  highlightedCategory: string | null; // Full category (e.g. subject.appearance)
  slotLabel: string;                // Category/slot (subject, action, camera, etc.)
  inlineContext: string;            // Short context around highlight
  prefix: string;                   // Text before highlight (trimmed)
  suffix: string;                   // Text after highlight (trimmed)
  promptPreview: string;            // Full prompt (trimmed)
  constraintLine: string;           // Simplified constraints
  constraintNotes?: string;         // Additional constraint notes
  modelLine: string;                // Target model (optional)
  sectionLine: string;              // Prompt section (optional)
  guidance: string;                 // Creative guidance (optional)
  focusGuidance?: string;           // Context-aware guidance (optional)
  spanAnchors?: string;             // Anchors from labeled spans
  nearbySpanHints?: string;         // Nearby spans to avoid conflicting with
  replacementInstruction: string;   // Deprecated - kept for compatibility
  highlightWordCount?: number | null;
  mode: 'rewrite' | 'placeholder';
}

/**
 * Contrastive decoding context
 */
export interface ContrastiveDecodingContext {
  systemPrompt: string;
  schema: OutputSchema;
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
 * Schema type for structured output
 * Compatible with StructuredOutputEnforcer's expected schema format
 */
export interface OutputSchema {
  type: 'object' | 'array';
  name?: string;
  strict?: boolean;
  required?: string[];
  items?: {
    required?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Fallback regeneration parameters
 */
export interface FallbackRegenerationParams {
  sanitizedSuggestions: Suggestion[];
  isVideoPrompt: boolean;
  isPlaceholder: boolean;
  videoConstraints?: VideoConstraints;
  lockedSpanCategories?: string[];
  regenerationDetails: {
    highlightWordCount?: number;
    phraseRole?: string;
    highlightedText?: string;
    highlightedCategory?: string;
    highlightedCategoryConfidence?: number;
  };
  requestParams: PromptBuildParams;
  aiService: AIModelService;
  schema: OutputSchema;
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
  metadata?: Record<string, unknown>;
}

/**
 * Service dependencies
 */
export interface VideoService {
  isVideoPrompt(fullPrompt: string): boolean;
  countWords(text: string): number;
  detectVideoPhraseRole(
    highlightedText: string,
    contextBefore: string,
    contextAfter: string,
    highlightedCategory?: string | null | undefined
  ): string | null;
  getVideoReplacementConstraints(
    details?: {
      highlightWordCount?: number | undefined;
      phraseRole?: string | null | undefined;
      highlightedText?: string | undefined;
      highlightedCategory?: string | null | undefined;
      highlightedCategoryConfidence?: number | null | undefined;
    },
    options?: { forceMode?: string | undefined }
  ): VideoConstraints;
  detectTargetModel(fullPrompt: string): string | null;
  detectPromptSection(
    highlightedText: string,
    fullPrompt: string,
    contextBefore: string
  ): string | null;
  getCategoryFocusGuidance(
    phraseRole: string | null | undefined,
    categoryHint: string | null | undefined,
    fullContext: string,
    allSpans: Array<{ category?: string; text?: string }>,
    editHistory: EditHistoryEntry[]
  ): string[] | null;
  getVideoFallbackConstraints(
    currentConstraints: VideoConstraints | null | undefined,
    details?: Record<string, unknown>,
    attemptedModes?: Set<string>
  ): VideoConstraints | null;
}

export type AIService = AIModelService;

/**
 * Placeholder detector interface
 */
export interface PlaceholderDetector {
  detectPlaceholder(
    highlightedText: string,
    contextBefore: string,
    contextAfter: string,
    fullPrompt: string
  ): boolean;
}

/**
 * Brainstorm builder interface
 */
export interface BrainstormBuilder {
  buildBrainstormSignature(brainstormContext: BrainstormContext | null): BrainstormSignature | null;
}

/**
 * Prompt builder interface
 */
export interface PromptBuilder {
  buildPlaceholderPrompt(params: PromptBuildParams): string;
  buildRewritePrompt(params: PromptBuildParams): string;
  buildCustomPrompt(params: CustomPromptParams): string;
}

/**
 * Validation service interface
 */
export interface ValidationService {
  sanitizeSuggestions(
    suggestions: Suggestion[] | string[],
    context: SanitizationContext
  ): Suggestion[];
  groupSuggestionsByCategory(suggestions: Suggestion[]): GroupedSuggestions[];
}

/**
 * Diversity enforcer interface
 */
export interface DiversityEnforcer {
  ensureDiverseSuggestions(suggestions: Suggestion[]): Promise<Suggestion[]>;
}

/**
 * Category aligner interface
 */
export interface CategoryAligner {
  enforceCategoryAlignment(
    suggestions: Suggestion[],
    params: ValidationParams
  ): CategoryAlignmentResult;
}

/**
 * Metrics service interface
 */
export interface MetricsService {
  recordEnhancementTiming(
    metrics: Record<string, unknown>,
    params: Record<string, unknown>
  ): void;
  recordAlert(type: string, data: Record<string, unknown>): void;
}

/**
 * Enhancement request parameters
 */
export interface EnhancementRequestParams {
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  brainstormContext?: BrainstormContext | null;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  highlightedPhrase?: string | null;
  allLabeledSpans?: LabeledSpan[];
  nearbySpans?: NearbySpan[];
  editHistory?: EditHistoryEntry[];
  i2vContext?: {
    observation: ImageObservation;
    lockMap: LockMap;
    constraintMode?: I2VConstraintMode;
  } | null;
}

/**
 * Custom suggestion request parameters
 */
export interface CustomSuggestionRequestParams {
  highlightedText: string;
  customRequest: string;
  fullPrompt: string;
  contextBefore?: string;
  contextAfter?: string;
  metadata?: Record<string, unknown> | null;
}

/**
 * Enhancement metrics
 */
export interface EnhancementMetrics {
  total: number;
  cache: boolean;
  cacheCheck: number;
  modelDetection: number;
  sectionDetection: number;
  promptBuild: number;
  groqCall: number;
  postProcessing: number;
  promptMode: PromptMode;
  usedContrastiveDecoding?: boolean;
}
