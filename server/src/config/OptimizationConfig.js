/**
 * Configuration for prompt optimization service
 * Centralizes all timeouts, token limits, and mode-specific settings
 */

export const OptimizationConfig = {
  // API timeout settings (in milliseconds)
  timeouts: {
    draft: 5000,           // Groq draft generation
    contextInference: 15000, // Context inference from prompt
    modeDetection: 10000,   // Mode detection
    qualityAssessment: 10000, // Quality assessment
    optimization: {
      default: 30000,
      video: 90000,         // Video prompts need more time
      reasoning: 45000,
      research: 45000,
      socratic: 45000,
    }
  },

  // Token limits for different operations
  tokens: {
    draft: {
      default: 200,
      video: 300,           // Video drafts can be longer
      reasoning: 200,
      research: 200,
      socratic: 200,
    },
    contextInference: 500,
    modeDetection: 300,
    qualityAssessment: 800,
    optimization: {
      default: 2500,
      video: 4000,
      reasoning: 3500,
      research: 3000,
      socratic: 3000,
    },
    domainContent: 1500,
  },

  // Temperature settings for different operations
  temperatures: {
    draft: 0.7,             // More creative for drafts
    contextInference: 0.3,  // Low for consistent inference
    modeDetection: 0.2,     // Very low for consistent mode detection
    qualityAssessment: 0.3, // Low for objective assessment
    optimization: {
      default: 0.3,
      video: 0.7,           // Higher creativity for video
      reasoning: 0.3,
      research: 0.4,
      socratic: 0.5,
    },
    domainContent: 0.4,
  },

  // Quality thresholds
  quality: {
    minAcceptableScore: 0.6,
    targetScore: 0.9,
    excellenceThreshold: 0.95,
    componentThresholds: {
      clarity: 0.7,
      specificity: 0.7,
      structure: 0.7,
      completeness: 0.7,
      actionability: 0.7,
    }
  },

  // Iterative refinement settings
  iterativeRefinement: {
    maxIterations: 3,
    improvementThreshold: 0.05, // Minimum improvement to continue
    timeoutPerIteration: 30000,
  },

  // Mode detection thresholds
  modeDetection: {
    minConfidenceThreshold: 0.3,
    defaultMode: 'optimize',
  },

  // Template versions for tracking improvements
  templateVersions: {
    default: '2.0.0',
    optimize: '3.0.0',
    reasoning: '4.0.0',
    research: '3.0.0',
    socratic: '3.0.0',
    video: '1.0.0'
  },

  // Span labeling configuration (for video mode)
  spanLabeling: {
    maxSpans: 60,
    minConfidence: 0.5,
    templateVersion: 'v1',
  },

  // Cache configuration keys
  cache: {
    promptOptimization: 'promptOptimization',
    contextInference: 'contextInference',
    modeDetection: 'modeDetection',
  }
};

export default OptimizationConfig;
