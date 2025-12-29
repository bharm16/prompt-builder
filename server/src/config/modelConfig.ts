/**
 * AI Model Configuration
 * 
 * Centralized configuration for routing LLM operations to specific providers.
 * This enables zero-code provider switching via configuration or environment variables.
 * 
 * Architecture: Dead Simple Router Pattern
 * - Each operation maps to a specific client + model configuration
 * - Supports automatic fallback to alternative providers
 * - Environment variables override defaults for production flexibility
 * 
 * Provider-Specific Optimizations:
 * - OpenAI: Temperature 0.0 for structured outputs (grammar-constrained)
 * - Groq/Qwen: Temperature 0.1 for structured outputs (avoids repetition loops)
 * - Seed parameter for reproducibility where determinism matters
 */

interface ModelConfigEntry {
  client: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  fallbackTo?: string;
  fallbackConfig?: {
    model: string;
    timeout: number;
  };
  responseFormat?: 'json_object';
  /** Enable seed-based reproducibility for this operation */
  useSeed?: boolean;
  /** Use developer message for hard constraints (OpenAI only) */
  useDeveloperMessage?: boolean;
}

type OperationName = keyof typeof ModelConfig;

const QWEN_FALLBACK = {
  model: process.env.QWEN_MODEL || 'qwen/qwen3-32b',
  timeout: parseInt(process.env.QWEN_TIMEOUT_MS || '10000', 10),
};

/**
 * Model Configuration Object
 * 
 * Each operation defines:
 * - client: Which API client to use ('openai', 'qwen', 'groq', or 'gemini')
 * - model: Specific model identifier
 * - temperature: Sampling temperature (0-2)
 * - maxTokens: Maximum tokens to generate
 * - timeout: Request timeout in milliseconds
 * - fallbackTo: (Optional) Alternative client if primary fails
 * - useSeed: (Optional) Enable seed-based reproducibility
 * - useDeveloperMessage: (Optional) Use developer role for constraints
 */
export const ModelConfig: Record<string, ModelConfigEntry> = {
  // ============================================================================
  // Prompt Optimization Operations
  // ============================================================================
  
  /**
   * Standard prompt optimization (quality-focused)
   * Uses OpenAI GPT-4o for best results
   * Note: Temperature kept at 0.7 for creative text generation (not structured output)
   */
  optimize_standard: {
    client: process.env.OPTIMIZE_PROVIDER || 'openai',
    model: process.env.OPTIMIZE_MODEL || 'gpt-4o-2024-08-06',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000,
    fallbackTo: 'qwen',
    fallbackConfig: QWEN_FALLBACK,
    useDeveloperMessage: true, // GPT-4o: Use developer role for format constraints
  },

  /**
   * Fast draft generation (speed-focused)
   * Uses OpenAI GPT-4o-mini for fast response times
   */
  optimize_draft: {
    client: process.env.DRAFT_PROVIDER || 'openai',
    model: process.env.DRAFT_MODEL || 'gpt-4o-mini-2024-07-18',
    temperature: 0.7,
    maxTokens: 500,
    timeout: 15000,
    fallbackTo: 'qwen',
    fallbackConfig: QWEN_FALLBACK,
    useSeed: true, // Same concept should draft similarly
    useDeveloperMessage: true,
  },

  /**
   * Context inference for reasoning mode
   */
  optimize_context_inference: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 30000,
    useSeed: true, // Deterministic context detection
  },

  /**
   * Mode detection (determine optimal optimization strategy)
   */
  optimize_mode_detection: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 512,
    timeout: 20000,
    useSeed: true, // Same prompt should detect same mode
  },

  /**
   * Quality assessment of prompts
   */
  optimize_quality_assessment: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 30000,
    useSeed: true, // Consistent quality scores
  },

  /**
   * Shot interpretation (maps raw concept to flexible shot plan)
   * Uses structured output - temperature 0.0 per GPT-4o best practices
   */
  optimize_shot_interpreter: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.0, // Deterministic mapping for structured output
    maxTokens: 600,
    timeout: 15000,
    responseFormat: 'json_object',
    useSeed: true, // Same concept should produce same shot plan
    useDeveloperMessage: true,
  },

  /**
   * Intent preservation check (evaluation-only)
   * Deterministic JSON output for pass/fail gating.
   */
  optimize_intent_check: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.0,
    maxTokens: 700,
    timeout: 20000,
    responseFormat: 'json_object',
    useSeed: true,
    useDeveloperMessage: true,
  },

  // ============================================================================
  // Enhancement Operations (Suggestion Generation)
  // ============================================================================

  /**
   * Main enhancement suggestion generation
   * 
   * Provider-specific temperature:
   * - OpenAI (when used): 0.0 for structured output
   * - Qwen: 0.1 (configured here, adapter may override)
   * 
   * Diversity is achieved through:
   * - Prompt: "Generate 12 DIVERSE alternatives"
   * - ContrastiveDiversityEnforcer post-processing
   */
  enhance_suggestions: {
    client: process.env.ENHANCE_PROVIDER || 'qwen',
    model: process.env.ENHANCE_MODEL || 'qwen/qwen3-32b',
    temperature: 0.1, // Keep low temp for reliable JSON; diversity enforced by prompting/post-processing
    maxTokens: 1024,
    timeout: 8000,
    responseFormat: 'json_object',
    fallbackTo: 'openai',
    // Note: Seed not used - we want variation in suggestions
  },

  /**
   * Style transfer for enhancement suggestions
   */
  enhance_style_transfer: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
  },

  /**
   * Suggestion deduplication (diversity enforcement)
   */
  enhance_diversity: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 512,
    timeout: 20000,
    useSeed: true, // Consistent deduplication
  },

  // ============================================================================
  // Video Concept Operations
  // ============================================================================

  /**
   * Video concept suggestion generation
   */
  video_concept_suggestions: {
    client: process.env.VIDEO_PROVIDER || 'openai',
    model: process.env.VIDEO_MODEL || 'gpt-4o-2024-08-06',
    temperature: 0.8,
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'qwen',
    fallbackConfig: QWEN_FALLBACK,
    useDeveloperMessage: true,
  },

  /**
   * Scene completion (fill empty elements)
   */
  video_scene_completion: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 30000,
  },

  /**
   * Scene variation generation
   * Note: High temperature for creativity, no seed (want variation)
   */
  video_scene_variation: {
    client: 'openai',
    model: 'gpt-4o-2024-08-06',
    temperature: 0.9,
    maxTokens: 1536,
    timeout: 40000,
  },

  /**
   * Concept parsing (text to structured elements)
   * Temperature 0.0 for deterministic parsing
   */
  video_concept_parsing: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.0,
    maxTokens: 1024,
    timeout: 25000,
    responseFormat: 'json_object',
    useSeed: true, // Same concept should parse identically
    useDeveloperMessage: true,
  },

  /**
   * Element refinement for coherence
   */
  video_refinement: {
    client: 'openai',
    model: 'gpt-4o-2024-08-06',
    temperature: 0.6,
    maxTokens: 1536,
    timeout: 35000,
  },

  /**
   * Technical parameter generation (camera, lighting)
   */
  video_technical_params: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 25000,
    useSeed: true, // Consistent technical params
  },

  /**
   * Prompt validation and smart defaults
   */
  video_validation: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 25000,
    useSeed: true, // Consistent validation
  },

  /**
   * Compatibility checking (semantic + thematic)
   */
  video_compatibility: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.2,
    maxTokens: 512,
    timeout: 20000,
    useSeed: true, // Consistent compatibility scores
  },

  /**
   * Conflict detection between elements
   */
  video_conflict_detection: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 25000,
    useSeed: true, // Consistent conflict detection
  },

  /**
   * Scene change detection
   */
  video_scene_detection: {
    client: 'openai',
    model: 'gpt-4o-mini-2024-07-18',
    temperature: 0.2,
    maxTokens: 1024,
    timeout: 25000,
    useSeed: true, // Consistent scene detection
  },

  // ============================================================================
  // Question Generation Operations
  // ============================================================================

  /**
   * Generate clarifying questions for prompt improvement
   * Temperature 0.0 for structured output
   */
  question_generation: {
    client: process.env.QUESTION_PROVIDER || 'openai',
    model: process.env.QUESTION_MODEL || 'gpt-4o-mini-2024-07-18',
    temperature: 0.0, // Deterministic question generation
    maxTokens: 2048,
    timeout: 30000,
    responseFormat: 'json_object',
    fallbackTo: 'qwen',
    fallbackConfig: QWEN_FALLBACK,
    useSeed: true, // Same prompt should generate same questions
    useDeveloperMessage: true,
  },

  // ============================================================================
  // Text Categorization Operations
  // ============================================================================

  /**
   * Categorize text into taxonomy
   * Temperature 0.0 for deterministic categorization
   */
  text_categorization: {
    client: process.env.CATEGORIZE_PROVIDER || 'openai',
    model: process.env.CATEGORIZE_MODEL || 'gpt-4o-mini-2024-07-18',
    temperature: 0.0,
    maxTokens: 1024,
    timeout: 25000,
    responseFormat: 'json_object',
    useSeed: true, // Same text should categorize identically
    useDeveloperMessage: true,
  },

  // ============================================================================
  // Span Labeling Operations (Video Prompt Analysis)
  // ============================================================================

  /**
   * Label spans in video prompts
   * 
   * Qwen/Groq best practices (via Groq-hosted Qwen models):
   * - Temperature 0.1 (not 0.0 - avoids repetition loops)
   * - Sandwich prompting for format adherence
   * - XML tagging for data segmentation
   */
  span_labeling: {
    client: process.env.SPAN_PROVIDER || 'qwen',
    model: process.env.SPAN_MODEL || 'qwen/qwen3-32b',
    temperature: 0.1, // Low temperature for reliable JSON
    maxTokens: 4096,
    timeout: 30000,
    responseFormat: 'json_object',
    fallbackTo: 'gemini',
    fallbackConfig: {
      model: 'gemini-2.5-flash',
      timeout: 45000,
    },
    useSeed: true, // Same text should label identically
  },

  /**
   * Explicit Gemini configuration for span labeling
   * Used by GeminiLlmClient to force Gemini usage regardless of SPAN_PROVIDER
   */
  span_labeling_gemini: {
    client: 'gemini',
    model: 'gemini-2.5-flash',
    temperature: 0.1,
    maxTokens: 16384,
    timeout: 45000,
    useSeed: true,
  },

  /**
   * Role classification for spans
   * Temperature 0.0 for deterministic classification
   */
  role_classification: {
    client: process.env.ROLE_PROVIDER || 'openai',
    model: process.env.ROLE_MODEL || 'gpt-4o-mini-2024-07-18',
    temperature: 0,
    maxTokens: 600,
    timeout: 20000,
    fallbackTo: 'qwen',
    fallbackConfig: QWEN_FALLBACK,
    useSeed: true, // Same spans should classify identically
    useDeveloperMessage: true,
  },

  // ============================================================================
  // LLM-as-a-Judge Operations
  // ============================================================================

  /**
   * LLM-as-a-Judge for video prompt evaluation
   */
  llm_judge_video: {
    client: process.env.JUDGE_PROVIDER || 'openai',
    model: process.env.JUDGE_MODEL || 'gpt-4o-2024-08-06',
    temperature: 0.2,
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'anthropic',
    useSeed: true, // Consistent evaluation scores
    useDeveloperMessage: true,
  },

  /**
   * LLM-as-a-Judge for general text evaluation
   */
  llm_judge_general: {
    client: process.env.JUDGE_GENERAL_PROVIDER || 'anthropic',
    model: process.env.JUDGE_GENERAL_MODEL || 'claude-sonnet-4',
    temperature: 0.3,
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'openai',
    useSeed: true, // Consistent evaluation
  },
};

/**
 * Default configuration for operations not explicitly defined
 * Temperature 0.0 for structured outputs by default
 */
export const DEFAULT_CONFIG: ModelConfigEntry = {
  client: 'openai',
  model: 'gpt-4o-mini-2024-07-18',
  temperature: 0.0,
  maxTokens: 2048,
  timeout: 30000,
  useSeed: false,
  useDeveloperMessage: false,
};

/**
 * Helper function to get configuration for an operation
 */
export function getModelConfig(operation: string): ModelConfigEntry {
  return ModelConfig[operation] || DEFAULT_CONFIG;
}

/**
 * Helper function to list all configured operations
 */
export function listOperations(): string[] {
  return Object.keys(ModelConfig);
}

/**
 * Check if an operation should use seed for reproducibility
 */
export function shouldUseSeed(operation: string): boolean {
  const config = ModelConfig[operation];
  return config?.useSeed ?? false;
}

/**
 * Check if an operation should use developer message (OpenAI)
 */
export function shouldUseDeveloperMessage(operation: string): boolean {
  const config = ModelConfig[operation];
  return config?.useDeveloperMessage ?? false;
}
