/**
 * Centralized configuration for span labeling
 *
 * All constants and defaults extracted from spanLabeler.js
 * This makes it easy to tune performance and behavior without
 * touching the core logic.
 */

/**
 * Performance and capacity constants
 */
export const PERFORMANCE = {
  // Hard upper bound to prevent excessive processing
  MAX_SPANS_ABSOLUTE_LIMIT: 80,

  // Conservative default for response generation
  DEFAULT_MAX_TOKENS: 800,

  // Base tokens for response structure (JSON overhead)
  TOKEN_ESTIMATION_BASE: 400,

  // Average tokens per span in response
  TOKEN_ESTIMATION_PER_SPAN: 25,

  // Absolute maximum tokens for any response
  MAX_TOKEN_RESPONSE_LIMIT: 4000,
};

/**
 * Default validation policy
 */
export const DEFAULT_POLICY = {
  // Maximum word count for non-technical spans
  nonTechnicalWordLimit: 6,

  // Whether to allow overlapping spans
  allowOverlap: false,
};

/**
 * Default processing options
 */
export const DEFAULT_OPTIONS = {
  // Maximum number of spans to return
  maxSpans: 60,

  // Minimum confidence threshold (0-1)
  minConfidence: 0.5,

  // Template version identifier - v2: Updated role taxonomy (Movement, Camera, Specs, Style, Quality)
  templateVersion: 'v2',
};

/**
 * Default confidence value for uncertain spans
 */
export const DEFAULT_CONFIDENCE = 0.7;

/**
 * LLM model configuration
 */
export const MODEL_CONFIG = {
  // Temperature for span labeling (0 = deterministic)
  temperature: 0,

  // Default timeout for LLM calls (ms)
  timeout: 30000,
};

/**
 * Validation modes
 */
export const VALIDATION_MODES = {
  // Strict validation - fails on any error
  STRICT: 1,

  // Lenient validation - drops invalid spans instead of failing
  LENIENT: 2,
};

/**
 * Text chunking configuration for large prompts
 */
export const CHUNKING = {
  // Max words before chunking is triggered
  MAX_WORDS_PER_CHUNK: 400,
  
  // Max tokens to reserve for output (used in token estimation)
  OUTPUT_TOKEN_BUFFER: 2000,
  
  // Whether to process chunks in parallel
  PROCESS_CHUNKS_IN_PARALLEL: true,
  
  // Max concurrent chunk requests
  MAX_CONCURRENT_CHUNKS: 3,
};

/**
 * NLP Fast-Path Configuration
 * Enables dictionary-based span extraction to bypass expensive LLM calls
 */
export const NLP_FAST_PATH = {
  // Enable NLP-based dictionary matching
  ENABLED: true,
  
  // Minimum number of spans required to skip LLM call
  MIN_SPANS_THRESHOLD: 3,
  
  // Minimum coverage percentage to skip LLM (0-100)
  MIN_COVERAGE_PERCENT: 30,
  
  // Enable detailed metrics tracking
  TRACK_METRICS: true,
  
  // Enable telemetry for cost savings calculation
  TRACK_COST_SAVINGS: true,
};

/**
 * Symbolic NLP Configuration (Phase 1 Implementation)
 * Enables full symbolic processing: POS tagging, chunking, SRL, frames, and scene graphs
 */
export const SYMBOLIC_NLP = {
  // Master switch for symbolic NLP pipeline
  ENABLED: true,
  
  // Feature flags for individual components
  FEATURES: {
    // Penn Treebank POS tagging with Brill transformation rules
    POS_TAGGING: true,
    
    // Shallow parsing / chunking (NP/VP/PP extraction)
    CHUNKING: true,
    
    // Frame semantics (Motion, Cinematography, Lighting)
    FRAME_SEMANTICS: true,
    
    // Semantic role labeling (Arg0/Arg1/ArgM)
    SEMANTIC_ROLES: true,
  },
  
  // Fallback strategy if symbolic processing fails
  FALLBACK_TO_DICTIONARY: true,
  
  // Fallback to LLM if symbolic processing produces insufficient results
  FALLBACK_TO_LLM: false,
  
  // Minimum confidence threshold for accepting symbolic spans (0-1)
  MIN_CONFIDENCE_THRESHOLD: 0.8,
  
  // Minimum number of semantic spans to consider successful
  MIN_SEMANTIC_SPANS: 15,

  // NEW: Require at least 3 frames matched
  MIN_FRAMES: 3, 

  // NEW: At least 10% of chunks should be VPs
  MIN_VP_RATIO: 0.1, 
  
  // Enable detailed semantic metadata in response
  INCLUDE_SEMANTIC_METADATA: true,
  
  // Enable relationship graph in response
  INCLUDE_RELATIONSHIPS: true,
  
  // Maximum processing time (ms) before fallback
  MAX_PROCESSING_TIME: 100,
};

/**
 * Get estimated max tokens for a given number of spans
 * @param {number} maxSpans - Maximum spans requested
 * @returns {number} Estimated max tokens needed
 */
export function estimateMaxTokens(maxSpans) {
  const estimated = PERFORMANCE.TOKEN_ESTIMATION_BASE +
                   (maxSpans * PERFORMANCE.TOKEN_ESTIMATION_PER_SPAN);
  return Math.min(PERFORMANCE.MAX_TOKEN_RESPONSE_LIMIT, estimated);
}

/**
 * Configuration export
 */
const SpanLabelingConfig = {
  PERFORMANCE,
  DEFAULT_POLICY,
  DEFAULT_OPTIONS,
  DEFAULT_CONFIDENCE,
  MODEL_CONFIG,
  VALIDATION_MODES,
  CHUNKING,
  NLP_FAST_PATH,
  SYMBOLIC_NLP,
  estimateMaxTokens,
};

export default SpanLabelingConfig;
