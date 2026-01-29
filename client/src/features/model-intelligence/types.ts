export interface FactorScore {
  factor: string;
  label: string;
  weight: number;
  capability: number;
  contribution: number;
  explanation: string;
}

export interface PromptRequirements {
  physics: {
    hasComplexPhysics: boolean;
    hasParticleSystems: boolean;
    hasFluidDynamics: boolean;
    hasSoftBodyPhysics: boolean;
    physicsComplexity: 'none' | 'simple' | 'moderate' | 'complex';
  };
  character: {
    hasHumanCharacter: boolean;
    hasAnimalCharacter: boolean;
    hasMechanicalCharacter: boolean;
    requiresFacialPerformance: boolean;
    requiresBodyLanguage: boolean;
    requiresLipSync: boolean;
    emotionalIntensity: 'none' | 'subtle' | 'moderate' | 'intense';
  };
  environment: {
    complexity: 'simple' | 'moderate' | 'complex';
    type: 'interior' | 'exterior' | 'abstract' | 'mixed';
    hasArchitecture: boolean;
    hasNature: boolean;
    hasUrbanElements: boolean;
  };
  lighting: {
    requirements: 'natural' | 'stylized' | 'dramatic' | 'mixed';
    complexity: 'simple' | 'moderate' | 'complex';
    hasPracticalLights: boolean;
    requiresAtmospherics: boolean;
  };
  style: {
    isPhotorealistic: boolean;
    isStylized: boolean;
    isAbstract: boolean;
    requiresCinematicLook: boolean;
    hasSpecificAesthetic: string | null;
  };
  motion: {
    cameraComplexity: 'static' | 'simple' | 'moderate' | 'complex';
    subjectComplexity: 'static' | 'simple' | 'moderate' | 'complex';
    hasMorphing: boolean;
    hasTransitions: boolean;
  };
  detectedCategories: string[];
  confidenceScore: number;
}

export interface ModelScore {
  modelId: string;
  overallScore: number;
  factorScores: FactorScore[];
  strengths: string[];
  weaknesses: string[];
  warnings: string[];
}

export interface ModelRecommendationSummary {
  modelId: string;
  confidence?: 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface ModelRecommendation {
  promptId: string;
  prompt: string;
  requirements?: PromptRequirements;
  recommendations: ModelScore[];
  recommended: ModelRecommendationSummary;
  alsoConsider?: ModelRecommendationSummary;
  suggestComparison: boolean;
  comparisonModels?: [string, string];
  filteredOut?: Array<{ modelId: string; reason: string }>;
  computedAt?: string;
}

export interface ModelRecommendationRequest {
  prompt: string;
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
}

export interface ModelRecommendationResponse {
  success: boolean;
  data?: ModelRecommendation;
  error?: string;
  details?: unknown;
}
