import type { VideoModelId } from '@services/video-generation/types';

export const COMPLEXITY_LEVELS = ['none', 'simple', 'moderate', 'complex'] as const;
export type ComplexityLevel = typeof COMPLEXITY_LEVELS[number];

export const EMOTIONAL_INTENSITY = ['none', 'subtle', 'moderate', 'intense'] as const;
export type EmotionalIntensity = typeof EMOTIONAL_INTENSITY[number];

export const ENVIRONMENT_TYPES = ['interior', 'exterior', 'abstract', 'mixed'] as const;
export type EnvironmentType = typeof ENVIRONMENT_TYPES[number];

export const LIGHTING_REQUIREMENTS = ['natural', 'stylized', 'dramatic', 'mixed'] as const;
export type LightingRequirement = typeof LIGHTING_REQUIREMENTS[number];

export const CAMERA_COMPLEXITY = ['static', 'simple', 'moderate', 'complex'] as const;
export type CameraComplexity = typeof CAMERA_COMPLEXITY[number];

export const SUBJECT_COMPLEXITY = ['static', 'simple', 'moderate', 'complex'] as const;
export type SubjectComplexity = typeof SUBJECT_COMPLEXITY[number];

export const SPEED_TIERS = ['fast', 'medium', 'slow'] as const;
export type SpeedTier = typeof SPEED_TIERS[number];

export const COST_TIERS = ['low', 'medium', 'high'] as const;
export type CostTier = typeof COST_TIERS[number];

export const QUALITY_TIERS = ['preview', 'standard', 'premium'] as const;
export type QualityTier = typeof QUALITY_TIERS[number];

export interface PromptSpan {
  text: string;
  role?: string;
  category?: string;
  start?: number;
  end?: number;
  confidence?: number;
}

export interface PromptRequirements {
  physics: {
    hasComplexPhysics: boolean;
    hasParticleSystems: boolean;
    hasFluidDynamics: boolean;
    hasSoftBodyPhysics: boolean;
    physicsComplexity: ComplexityLevel;
  };
  character: {
    hasHumanCharacter: boolean;
    hasAnimalCharacter: boolean;
    hasMechanicalCharacter: boolean;
    requiresFacialPerformance: boolean;
    requiresBodyLanguage: boolean;
    requiresLipSync: boolean;
    emotionalIntensity: EmotionalIntensity;
  };
  environment: {
    complexity: 'simple' | 'moderate' | 'complex';
    type: EnvironmentType;
    hasArchitecture: boolean;
    hasNature: boolean;
    hasUrbanElements: boolean;
  };
  lighting: {
    requirements: LightingRequirement;
    complexity: 'simple' | 'moderate' | 'complex';
    hasPracticalLights: boolean;
    requiresAtmospherics: boolean;
  };
  style: {
    isPhotorealistic: boolean;
    isStylized: boolean;
    isAbstract: boolean;
    requiresCinematicLook: boolean;
    hasSpecificAesthetic: string | undefined;
  };
  motion: {
    cameraComplexity: CameraComplexity;
    subjectComplexity: SubjectComplexity;
    hasMorphing: boolean;
    hasTransitions: boolean;
  };
  detectedCategories: string[];
  confidenceScore: number;
}

export interface ModelCapabilities {
  physics: number;
  particleSystems: number;
  fluidDynamics: number;
  facialPerformance: number;
  bodyLanguage: number;
  characterActing: number;
  cinematicLighting: number;
  atmospherics: number;
  environmentDetail: number;
  architecturalAccuracy: number;
  motionComplexity: number;
  cameraControl: number;
  stylization: number;
  photorealism: number;
  morphing: number;
  transitions: number;
  i2vBoost?: number;
  t2vBoost?: number;
  speedTier: SpeedTier;
  costTier: CostTier;
  qualityTier: QualityTier;
}

export interface FactorScore {
  factor: string;
  label: string;
  weight: number;
  capability: number;
  contribution: number;
  explanation: string;
}

export interface ModelScore {
  modelId: VideoModelId;
  overallScore: number;
  factorScores: FactorScore[];
  strengths: string[];
  weaknesses: string[];
  warnings: string[];
}

export interface ModelRecommendation {
  promptId: string;
  prompt: string;
  requirements: PromptRequirements;
  recommendations: ModelScore[];
  recommended: {
    modelId: VideoModelId;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
  alsoConsider?: {
    modelId: VideoModelId;
    reasoning: string;
  };
  suggestComparison: boolean;
  comparisonModels?: [VideoModelId, VideoModelId];
  filteredOut?: Array<{ modelId: VideoModelId; reason: string }>;
  computedAt: Date;
}
