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
}

type OperationName = keyof typeof ModelConfig;

/**
 * Model Configuration Object
 * 
 * Each operation defines:
 * - client: Which API client to use ('openai', 'groq', or 'gemini')
 * - model: Specific model identifier
 * - temperature: Sampling temperature (0-2)
 * - maxTokens: Maximum tokens to generate
 * - timeout: Request timeout in milliseconds
 * - fallbackTo: (Optional) Alternative client if primary fails
 */
export const ModelConfig: Record<string, ModelConfigEntry> = {
  // ============================================================================
  // Prompt Optimization Operations
  // ============================================================================
  
  /**
   * Standard prompt optimization (quality-focused)
   * Uses OpenAI GPT-4o for best results
   */
  optimize_standard: {
    client: process.env.OPTIMIZE_PROVIDER || 'openai',
    model: process.env.OPTIMIZE_MODEL || 'gpt-4o',
    temperature: 0.7,
    maxTokens: 4096,
    timeout: 60000, // 60 seconds
    fallbackTo: 'groq', // Fallback to Groq if OpenAI fails
  },

  /**
   * Fast draft generation (speed-focused)
   * Uses Groq Llama 3.1 8B for sub-second response times
   */
  optimize_draft: {
    client: process.env.DRAFT_PROVIDER || 'groq',
    model: process.env.DRAFT_MODEL || 'llama-3.1-8b-instant',
    temperature: 0.7,
    maxTokens: 500, // Keep drafts concise
    timeout: 5000, // 5 seconds
    fallbackTo: 'openai', // Fallback to OpenAI if Groq unavailable
  },

  /**
   * Context inference for reasoning mode
   */
  optimize_context_inference: {
    client: 'openai',
    model: 'gpt-4o-mini', // Faster model for analysis
    temperature: 0.3, // Lower temp for more focused analysis
    maxTokens: 1024,
    timeout: 30000,
  },

  /**
   * Mode detection (determine optimal optimization strategy)
   */
  optimize_mode_detection: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 512,
    timeout: 20000,
  },

  /**
   * Quality assessment of prompts
   */
  optimize_quality_assessment: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.2, // Very low temp for consistent scoring
    maxTokens: 1024,
    timeout: 30000,
  },

  /**
   * Shot interpretation (maps raw concept to flexible shot plan)
   */
  optimize_shot_interpreter: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.0, // deterministic mapping
    maxTokens: 600,
    timeout: 15000,
    responseFormat: 'json_object',
  },

  // ============================================================================
  // Enhancement Operations (Suggestion Generation)
  // ============================================================================

  /**
   * Main enhancement suggestion generation
   * Uses fast draft model for real-time suggestions
   */
  enhance_suggestions: {
    client: process.env.ENHANCE_PROVIDER || 'groq',
    model: process.env.ENHANCE_MODEL || 'llama-3.1-8b-instant',
    temperature: 0.8, // Higher creativity for suggestions
    maxTokens: 1024,
    timeout: 8000,
    responseFormat: 'json_object', // Requires JSON for structured output
    fallbackTo: 'openai',
  },

  /**
   * Style transfer for enhancement suggestions
   */
  enhance_style_transfer: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
  },

  /**
   * Suggestion deduplication (diversity enforcement)
   */
  enhance_diversity: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 512,
    timeout: 20000,
  },

  // ============================================================================
  // Video Concept Operations
  // ============================================================================

  /**
   * Video concept suggestion generation
   */
  video_concept_suggestions: {
    client: process.env.VIDEO_PROVIDER || 'openai',
    model: process.env.VIDEO_MODEL || 'gpt-4o',
    temperature: 0.8, // High creativity for video concepts
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'groq',
  },

  /**
   * Scene completion (fill empty elements)
   */
  video_scene_completion: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 1024,
    timeout: 30000,
  },

  /**
   * Scene variation generation
   */
  video_scene_variation: {
    client: 'openai',
    model: 'gpt-4o',
    temperature: 0.9, // Very high creativity for variations
    maxTokens: 1536,
    timeout: 40000,
  },

  /**
   * Concept parsing (text to structured elements)
   */
  video_concept_parsing: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3, // Low temp for accurate parsing
    maxTokens: 1024,
    timeout: 25000,
    responseFormat: 'json_object', // Requires JSON for structured data
  },

  /**
   * Element refinement for coherence
   */
  video_refinement: {
    client: 'openai',
    model: 'gpt-4o',
    temperature: 0.6,
    maxTokens: 1536,
    timeout: 35000,
  },

  /**
   * Technical parameter generation (camera, lighting)
   */
  video_technical_params: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.5,
    maxTokens: 1024,
    timeout: 25000,
  },

  /**
   * Prompt validation and smart defaults
   */
  video_validation: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1024,
    timeout: 25000,
  },

  /**
   * Compatibility checking (semantic + thematic)
   */
  video_compatibility: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.2, // Very low for consistent scoring
    maxTokens: 512,
    timeout: 20000,
  },

  /**
   * Conflict detection between elements
   */
  video_conflict_detection: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1024,
    timeout: 25000,
  },

  /**
   * Scene change detection
   */
  video_scene_detection: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    maxTokens: 1024,
    timeout: 25000,
  },

  // ============================================================================
  // Question Generation Operations
  // ============================================================================

  /**
   * Generate clarifying questions for prompt improvement
   */
  question_generation: {
    client: process.env.QUESTION_PROVIDER || 'openai',
    model: process.env.QUESTION_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 2048,
    timeout: 30000,
    responseFormat: 'json_object', // Requires JSON for question array
    fallbackTo: 'groq',
  },

  // ============================================================================
  // Text Categorization Operations
  // ============================================================================

  /**
   * Categorize text into taxonomy
   */
  text_categorization: {
    client: process.env.CATEGORIZE_PROVIDER || 'openai',
    model: process.env.CATEGORIZE_MODEL || 'gpt-4o-mini',
    temperature: 0.2, // Very low for consistent categorization
    maxTokens: 1024,
    timeout: 25000,
    responseFormat: 'json_object', // Requires JSON for deterministic output
  },

  // ============================================================================
  // Span Labeling Operations (Video Prompt Analysis)
  // ============================================================================

  /**
   * Label spans in video prompts (technical, style, subject, etc.)
   */
  span_labeling: {
    client: process.env.SPAN_PROVIDER || 'groq',
    model: process.env.SPAN_MODEL || 'llama-3.1-8b-instant',
    temperature: 0.2, // Very low for accurate labeling
    maxTokens: 4096, // Larger for detailed span data
    timeout: 30000,
    responseFormat: 'json_object', // Requires JSON for span offsets/labels
    fallbackTo: 'gemini',
    fallbackConfig: {
      model: 'gemini-2.5-flash',
      timeout: 45000,  // Gemini needs more time than Groq but less than OpenAI
    },
  },

  /**
   * Role classification for spans (categorize into taxonomy)
   */
  role_classification: {
    client: process.env.ROLE_PROVIDER || 'openai',
    model: process.env.ROLE_MODEL || 'gpt-4o-mini',
    temperature: 0, // Zero temp for deterministic classification
    maxTokens: 600,
    timeout: 20000,
    fallbackTo: 'groq',
  },

  // ============================================================================
  // LLM-as-a-Judge Operations (PDF Enhancement)
  // ============================================================================

  /**
   * LLM-as-a-Judge for video prompt evaluation
   * Uses high-capability model (GPT-4o) for quality assessment
   */
  llm_judge_video: {
    client: process.env.JUDGE_PROVIDER || 'openai',
    model: process.env.JUDGE_MODEL || 'gpt-4o',
    temperature: 0.2, // Low temp for consistent evaluation
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'anthropic',
  },

  /**
   * LLM-as-a-Judge for general text evaluation
   * Can use Claude for detailed qualitative analysis
   */
  llm_judge_general: {
    client: process.env.JUDGE_GENERAL_PROVIDER || 'anthropic',
    model: process.env.JUDGE_GENERAL_MODEL || 'claude-sonnet-4',
    temperature: 0.3, // Slightly higher for nuanced evaluation
    maxTokens: 2048,
    timeout: 45000,
    fallbackTo: 'openai',
  },
};

/**
 * Default configuration for operations not explicitly defined
 */
export const DEFAULT_CONFIG: ModelConfigEntry = {
  client: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 2048,
  timeout: 30000,
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

