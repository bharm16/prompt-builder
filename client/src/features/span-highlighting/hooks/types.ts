/**
 * Centralized Type Definitions for Span Highlighting Hooks
 * 
 * All shared types used across span highlighting hooks are defined here
 * to ensure consistency and maintainability.
 */

// ============================================================================
// BASE TYPES
// ============================================================================

/**
 * Base span interface - represents a text span with position and metadata
 * Uses the most complete definition from HighlightSpan as the base
 */
export interface Span {
  id?: string | undefined;
  start: number;
  end: number;
  displayStart?: number | undefined;
  displayEnd?: number | undefined;
  text?: string | undefined;
  quote?: string | undefined;
  displayQuote?: string | undefined;
  category?: string | undefined;
  role?: string | undefined;
  confidence?: number | undefined;
  source?: string | undefined;
  startGrapheme?: number | undefined;
  endGrapheme?: number | undefined;
  validatorPass?: boolean | undefined;
  idempotencyKey?: string | undefined;
  leftCtx?: string | undefined;
  rightCtx?: string | undefined;
  displayLeftCtx?: string | undefined;
  displayRightCtx?: string | undefined;
}

/**
 * Parse result containing spans and display text
 */
export interface ParseResult {
  spans?: Span[];
  displayText?: string;
}

/**
 * Text node index for DOM manipulation
 */
export interface TextNodeIndex {
  nodes: Array<{ node: Node; start: number; end: number }>;
  length: number;
}

// ============================================================================
// SPAN LABELING TYPES
// ============================================================================

/**
 * Labeled span from the API - always has required category and confidence
 */
export interface LabeledSpan extends Span {
  category: string;
  confidence: number;
}

export interface SpanMeta extends Record<string, unknown> {
  version?: string;
  source?: string;
  cacheAge?: number;
  error?: string;
}

export interface SpanLabelingResult {
  spans: LabeledSpan[];
  meta: SpanMeta | null;
  text: string;
  signature: string;
  cacheId: string | null;
  source: 'initial' | 'cache' | 'network' | 'cache-fallback' | 'refresh-cache';
}

export type SpanLabelingStatus = 'idle' | 'loading' | 'refreshing' | 'success' | 'error' | 'stale';

export interface SpanLabelingState {
  spans: LabeledSpan[];
  meta: SpanMeta | null;
  status: SpanLabelingStatus;
  error: Error | null;
  signature: string | null;
}

/**
 * Span labeling policy configuration
 *
 * **Important:** When passing this to `useSpanLabeling`, wrap it in `useMemo` for referential stability.
 * This prevents unnecessary re-renders and cache invalidation.
 *
 * @example
 * ```tsx
 * const policy = useMemo(() => ({
 *   allowOverlap: true,
 *   nonTechnicalWordLimit: 10
 * }), []);
 * ```
 */
export interface SpanLabelingPolicy {
  nonTechnicalWordLimit?: number;
  allowOverlap: boolean;
}

export interface SpanLabelingPayload {
  text: string;
  cacheId?: string;
  maxSpans?: number;
  minConfidence?: number;
  policy?: SpanLabelingPolicy;
  templateVersion?: string;
  isI2VMode?: boolean;
}

export interface InitialData {
  spans: LabeledSpan[];
  meta: SpanMeta | null;
  signature: string;
}

export interface UseSpanLabelingOptions {
  text?: string | null;
  initialData?: InitialData | null;
  initialDataVersion?: number;
  cacheKey?: string | null;
  enabled?: boolean;
  immediate?: boolean;
  maxSpans?: number;
  minConfidence?: number;
  policy?: Partial<SpanLabelingPolicy>;
  templateVersion?: string;
  debounceMs?: number;
  useSmartDebounce?: boolean;
  onResult?: (result: SpanLabelingResult) => void;
}

export interface UseSpanLabelingReturn {
  spans: LabeledSpan[];
  meta: SpanMeta | null;
  status: SpanLabelingStatus;
  error: Error | null;
  signature: string | null;
  refresh: () => void;
}

// ============================================================================
// HIGHLIGHT RENDERING TYPES
// ============================================================================

/**
 * Highlight span - alias for Span for backward compatibility
 */
export type HighlightSpan = Span;

export interface SpanEntry {
  span: HighlightSpan;
  wrappers: HTMLElement[];
}

export interface HighlightState {
  spanMap: Map<string, SpanEntry>;
  nodeIndex: TextNodeIndex | null;
  fingerprint: string | null;
}

export interface UseHighlightRenderingOptions {
  editorRef: React.RefObject<HTMLElement>;
  parseResult?: ParseResult | null;
  enabled?: boolean;
  fingerprint?: string | null;
  text?: string | null;
}

// ============================================================================
// PROGRESSIVE SPAN RENDERING TYPES
// ============================================================================

export interface UseProgressiveSpanRenderingOptions {
  spans?: Span[];
  enabled?: boolean;
  highConfidenceDelay?: number;
  mediumConfidenceDelay?: number;
  lowConfidenceDelay?: number;
  highConfidenceThreshold?: number;
  mediumConfidenceThreshold?: number;
}

export interface UseProgressiveSpanRenderingReturn {
  visibleSpans: Span[];
  isRendering: boolean;
  progress: number;
  stats: {
    total: number;
    visible: number;
    remaining: number;
  };
}

// ============================================================================
// HIGHLIGHT SOURCE SELECTION TYPES
// ============================================================================

export interface SpanData {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
}

export interface HighlightSourceResult {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
  signature: string;
  cacheId: string | null;
  source: 'draft' | 'refined' | 'persisted';
}

export interface UseHighlightSourceSelectionOptions {
  draftSpans?: SpanData | null;
  refinedSpans?: SpanData | null;
  isDraftReady?: boolean;
  isRefining?: boolean;
  initialHighlights?: {
    spans: Array<{
      start: number;
      end: number;
      category: string;
      confidence: number;
    }>;
    meta?: Record<string, unknown> | null;
    signature?: string;
    cacheId?: string | null;
  } | null;
  promptUuid?: string | null;
  displayedPrompt?: string | null;
  enableMLHighlighting?: boolean;
  initialHighlightsVersion?: number;
}

// ============================================================================
// SPAN WORKER TYPES
// ============================================================================

export interface ProcessingOptions {
  minConfidence?: number;
  maxSpans?: number;
  removeOverlaps?: boolean;
}

export interface ProcessedResult {
  processedSpans: Span[];
  meta: {
    originalCount: number;
    processedCount: number;
    processingTime: number;
    usedWorker: boolean;
  };
}

export interface WorkerCallback {
  resolve: (value: ProcessedResult) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface WorkerMessage {
  id: number;
  type: 'ready' | 'result' | 'error' | 'process';
  processedSpans?: Span[];
  meta?: Record<string, unknown>;
  error?: string;
  spans?: Span[];
  text?: string;
  options?: ProcessingOptions;
}

// ============================================================================
// DEBOUNCED VALIDATION TYPES
// ============================================================================

export interface ValidationResult {
  pass: boolean;
  reason?: string;
}

export interface ValidationState {
  valid: Span[];
  invalid: Array<{ span: Span; reason?: string }>;
  validatedAt: number | null;
}

export type ValidatorFunction = (span: Span) => ValidationResult;
