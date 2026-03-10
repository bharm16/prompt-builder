/**
 * Configuration for prompt optimization service
 * Centralizes all timeouts, token limits, and mode-specific settings
 */

interface OptimizationTimeouts {
  draft: number;
  contextInference: number;
  modeDetection: number;
  optimization: {
    default: number;
    video: number;
  };
}

interface OptimizationTokens {
  draft: {
    default: number;
    video: number;
  };
  contextInference: number;
  modeDetection: number;
  optimization: {
    default: number;
    video: number;
  };
  domainContent: number;
}

interface OptimizationTemperatures {
  draft: number;
  contextInference: number;
  modeDetection: number;
  optimization: {
    default: number;
    video: number;
  };
  domainContent: number;
}

interface QualityThresholds {
  minAcceptableScore: number;
}

interface ModeDetectionConfig {
  minConfidenceThreshold: number;
  defaultMode: string;
}

interface TemplateVersions {
  default: string;
  video: string;
}

interface SpanLabelingConfig {
  maxSpans: number;
  minConfidence: number;
  templateVersion: string;
}

interface ConstitutionalAIConfig {
  sampleRate: number;
}

interface CacheConfig {
  promptOptimization: string;
  contextInference: string;
  modeDetection: string;
}

export const OptimizationConfig = {
  // API timeout settings (in milliseconds)
  timeouts: {
    draft: 15000,          // ChatGPT draft generation (slower than Groq but still fast)
    contextInference: 15000, // Context inference from prompt
    modeDetection: 10000,   // Mode detection
    optimization: {
      default: 30000,
      video: 90000,         // Video prompts need more time
    },
  } as OptimizationTimeouts,

  // Token limits for different operations
  tokens: {
    draft: {
      default: 200,
      video: 300,           // Video drafts can be longer
    },
    contextInference: 500,
    modeDetection: 300,
    optimization: {
      default: 2500,
      video: 4000,
    },
    domainContent: 1500,
  } as OptimizationTokens,

  // Temperature settings for different operations
  temperatures: {
    draft: 0.7,             // More creative for drafts
    contextInference: 0.3,  // Low for consistent inference
    modeDetection: 0.2,     // Very low for consistent mode detection
    optimization: {
      default: 0.3,
      video: 0.7,           // Higher creativity for video
    },
    domainContent: 0.4,
  } as OptimizationTemperatures,

  // Quality thresholds
  quality: {
    minAcceptableScore: 0.6,
  } as QualityThresholds,

  // Mode detection thresholds
  modeDetection: {
    minConfidenceThreshold: 0.3,
    defaultMode: 'video',
  } as ModeDetectionConfig,

  // Template versions for tracking improvements
  templateVersions: {
    default: '2.0.0',
    video: '1.0.0',
  } as TemplateVersions,

  // Span labeling configuration (for video mode)
  spanLabeling: {
    maxSpans: 60,
    minConfidence: 0.5,
    templateVersion: 'v1',
  } as SpanLabelingConfig,

  // Constitutional AI sampling (1 = always, 0 = never)
  constitutionalAI: {
    sampleRate: 1,
  } as ConstitutionalAIConfig,

  // Cache configuration keys
  cache: {
    promptOptimization: 'promptOptimization',
    contextInference: 'contextInference',
    modeDetection: 'modeDetection',
  } as CacheConfig,
} as const;

export default OptimizationConfig;
