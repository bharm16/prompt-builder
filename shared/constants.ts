/**
 * Application-wide constants
 * Centralizes magic numbers and strings for consistency and maintainability
 */

// ============================================================================
// Timing Constants
// ============================================================================
export const TIMING = {
  // UI Feedback
  AUTO_SAVE_DELAY_MS: 2000,
  TOAST_DISPLAY_DURATION_MS: 2000,
  COPY_FEEDBACK_DURATION_MS: 2000,
  
  // API Timeouts
  API_DEFAULT_TIMEOUT_MS: 60000, // 60 seconds
  API_VIDEO_MODE_TIMEOUT_MS: 90000, // 90 seconds for video prompts
  GROQ_TIMEOUT_MS: 5000, // 5 seconds for fast draft generation
  HEALTH_CHECK_TIMEOUT_MS: 5000,
  
  // Debouncing
  DEBOUNCE_DEFAULT_MS: 500,
  DEBOUNCE_SHORT_TEXT_MS: 150, // < 500 chars
  DEBOUNCE_MEDIUM_TEXT_MS: 300, // 500-2000 chars
  DEBOUNCE_LONG_TEXT_MS: 450, // > 2000 chars
  DEBOUNCE_VERY_SHORT_MS: 50, // < 100 chars
  
  // Rate Limiting Windows
  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_API_WINDOW_MS: 60000, // 1 minute
  RATE_LIMIT_BURST_2S_MS: 2000,
  RATE_LIMIT_BURST_3S_MS: 3000,
  
  // Circuit Breaker
  CIRCUIT_BREAKER_RESET_TIMEOUT_MS: 30000, // 30 seconds
  CIRCUIT_BREAKER_ROLLING_WINDOW_MS: 10000, // 10 seconds
  
  // Server
  SERVER_KEEP_ALIVE_TIMEOUT_MS: 65000,
  SERVER_HEADERS_TIMEOUT_MS: 66000,
} as const;

// ============================================================================
// Cache Constants
// ============================================================================
export const CACHE = {
  // Keys
  SPAN_LABELING_KEY: 'promptBuilder.spanLabelingCache.v1',
  SESSION_STORAGE_KEY: 'wizard_video_builder_draft',
  
  // Limits
  MAX_ENTRIES: 50,
  MAX_MEMORY_CACHE_SIZE: 100,
  
  // TTLs (Time To Live)
  MAX_AGE_MS: 24 * 60 * 60 * 1000, // 24 hours
  PROMPT_OPTIMIZATION_TTL: 3600, // 1 hour
  SPAN_LABELING_DEFAULT_TTL: 3600, // 1 hour
  SPAN_LABELING_SHORT_TTL: 300, // 5 minutes for large texts
  DOMAIN_CONTENT_TTL: 3600, // 1 hour
} as const;

// ============================================================================
// Token Limits (LLM)
// ============================================================================
export const TOKEN_LIMITS = {
  MAX_TOKENS_PER_SPAN: 25,
  BASE_TOKEN_OVERHEAD: 400,
  ABSOLUTE_MAX_TOKENS: 4000,
  
  // Draft generation (Groq)
  DRAFT_VIDEO_MODE_TOKENS: 300,
  DRAFT_DEFAULT_TOKENS: 200,
  
  // Refinement
  REFINEMENT_MAX_TOKENS: 4096,
  
  // Stage 1 domain content
  DOMAIN_CONTENT_MAX_TOKENS: 1500,
  
  // Health check
  HEALTH_CHECK_MAX_TOKENS: 10,
} as const;

// ============================================================================
// Text Length Thresholds
// ============================================================================
export const TEXT_LENGTH = {
  VERY_SHORT: 100,
  SHORT: 500,
  MEDIUM: 2000,
  
  // For cache preview
  PREVIEW_LENGTH: 100,
  BODY_PREVIEW_LENGTH: 300,
} as const;

// ============================================================================
// Rate Limits
// ============================================================================
export const RATE_LIMITS = {
  // Development (generous)
  DEV_GENERAL_MAX: 500,
  DEV_API_MAX: 300,
  DEV_LLM_MAX: 400,
  
  // Production (conservative)
  PROD_GENERAL_MAX: 100,
  PROD_API_MAX: 60,
  PROD_LLM_MAX: 100,
  
  // Health checks
  HEALTH_MAX_PER_MINUTE: 60,
  
  // Burst limits
  COMPATIBILITY_CHECK_2S_MAX: 3,
  COMPATIBILITY_CHECK_1M_MAX: 30,
  SUGGESTIONS_3S_MAX: 2,
  SUGGESTIONS_1M_MAX: 20,
} as const;

// ============================================================================
// Concurrency Limits
// ============================================================================
export const CONCURRENCY = {
  OPENAI_MAX_CONCURRENT: 5, // Max concurrent OpenAI requests
  QUEUE_TIMEOUT_MS: 30000, // 30 seconds queue timeout
} as const;

// ============================================================================
// Circuit Breaker Thresholds
// ============================================================================
export const CIRCUIT_BREAKER = {
  ERROR_THRESHOLD_PERCENTAGE: 50, // Open circuit at 50% error rate
  ROLLING_COUNT_BUCKETS: 10,
} as const;

// ============================================================================
// Validation Constants
// ============================================================================
export const VALIDATION = {
  // Span labeling
  MAX_SPANS: 60,
  MIN_CONFIDENCE: 0.5,
  NON_TECHNICAL_WORD_LIMIT: 6,
  
  // Prompt optimization
  MIN_PROMPT_QUALITY_SCORE: 60,
  EXCELLENT_PROMPT_SCORE: 80,
} as const;

// ============================================================================
// HTTP Status Codes
// ============================================================================
export const HTTP_STATUS = {
  OK: 200,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

// ============================================================================
// Security Constants
// ============================================================================
export const SECURITY = {
  // HSTS
  HSTS_MAX_AGE: 31536000, // 1 year in seconds
  
  // CORS max age
  CORS_MAX_AGE: 86400, // 24 hours in seconds
  
  // Body size limits
  BODY_SIZE_LIMIT: '2mb',
} as const;

// ============================================================================
// Compression Constants
// ============================================================================
export const COMPRESSION = {
  LEVEL: 6, // Compression level (0-9)
} as const;

// ============================================================================
// Performance Budgets
// ============================================================================
export const PERFORMANCE = {
  // Target latencies (milliseconds)
  TARGET_API_P95_MS: 200, // 95th percentile API response time
  TARGET_CACHE_LOOKUP_MS: 5, // Cache hit latency
  TARGET_SPAN_LABELING_MS: 3000, // Total span labeling time
  
  // Memory budgets
  MAX_BUNDLE_SIZE_KB: 250, // Gzipped bundle size for 3G networks
} as const;

// ============================================================================
// Error Messages
// ============================================================================
export const ERROR_MESSAGES = {
  // API Errors
  API_UNAVAILABLE: 'AI API is currently unavailable',
  API_TIMEOUT: 'AI API request timed out - system overloaded',
  API_RATE_LIMIT: 'Too many requests from this IP',
  
  // Validation Errors
  PROMPT_REQUIRED: 'Please enter a prompt',
  INVALID_MODE: 'Invalid optimization mode',
  
  // Server Errors
  OPENAI_KEY_MISSING: 'FATAL: Application cannot start without valid OpenAI API key',
  CORS_NOT_CONFIGURED: 'CORS configuration error: No allowed origins configured for production',
} as const;

// ============================================================================
// Model Defaults
// ============================================================================
export const MODELS = {
  OPENAI_DEFAULT: 'gpt-4o-mini',
  GROQ_DEFAULT: 'llama-3.1-8b-instant',
} as const;

// ============================================================================
// Template Versions
// ============================================================================
export const TEMPLATE_VERSIONS = {
  DEFAULT: '2.0.0',
  OPTIMIZE: '3.0.0',
  REASONING: '4.0.0',
  RESEARCH: '3.0.0',
  SOCRATIC: '3.0.0',
  VIDEO: '1.0.0',
} as const;

