import { z } from 'zod';

const FactorScoreSchema = z.object({
  factor: z.string(),
  label: z.string(),
  weight: z.number(),
  capability: z.number(),
  contribution: z.number(),
  explanation: z.string(),
});

const ModelScoreSchema = z.object({
  modelId: z.string(),
  overallScore: z.number(),
  factorScores: z.array(FactorScoreSchema).default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
});

const RecommendationSummarySchema = z.object({
  modelId: z.string(),
  confidence: z.enum(['high', 'medium', 'low']).optional(),
  reasoning: z.string(),
});

const PromptRequirementsSchema = z.object({
  physics: z.object({
    hasComplexPhysics: z.boolean(),
    hasParticleSystems: z.boolean(),
    hasFluidDynamics: z.boolean(),
    hasSoftBodyPhysics: z.boolean(),
    physicsComplexity: z.enum(['none', 'simple', 'moderate', 'complex']),
  }),
  character: z.object({
    hasHumanCharacter: z.boolean(),
    hasAnimalCharacter: z.boolean(),
    hasMechanicalCharacter: z.boolean(),
    requiresFacialPerformance: z.boolean(),
    requiresBodyLanguage: z.boolean(),
    requiresLipSync: z.boolean(),
    emotionalIntensity: z.enum(['none', 'subtle', 'moderate', 'intense']),
  }),
  environment: z.object({
    complexity: z.enum(['simple', 'moderate', 'complex']),
    type: z.enum(['interior', 'exterior', 'abstract', 'mixed']),
    hasArchitecture: z.boolean(),
    hasNature: z.boolean(),
    hasUrbanElements: z.boolean(),
  }),
  lighting: z.object({
    requirements: z.enum(['natural', 'stylized', 'dramatic', 'mixed']),
    complexity: z.enum(['simple', 'moderate', 'complex']),
    hasPracticalLights: z.boolean(),
    requiresAtmospherics: z.boolean(),
  }),
  style: z.object({
    isPhotorealistic: z.boolean(),
    isStylized: z.boolean(),
    isAbstract: z.boolean(),
    requiresCinematicLook: z.boolean(),
    hasSpecificAesthetic: z.string().nullable(),
  }),
  motion: z.object({
    cameraComplexity: z.enum(['static', 'simple', 'moderate', 'complex']),
    subjectComplexity: z.enum(['static', 'simple', 'moderate', 'complex']),
    hasMorphing: z.boolean(),
    hasTransitions: z.boolean(),
  }),
  detectedCategories: z.array(z.string()),
  confidenceScore: z.number(),
});

export const ModelRecommendationSchema = z
  .object({
    promptId: z.string(),
    prompt: z.string(),
    requirements: PromptRequirementsSchema.optional(),
    recommendations: z.array(ModelScoreSchema),
    recommended: RecommendationSummarySchema,
    alsoConsider: RecommendationSummarySchema.optional(),
    suggestComparison: z.boolean(),
    comparisonModels: z.tuple([z.string(), z.string()]).optional(),
    filteredOut: z
      .array(
        z.object({
          modelId: z.string(),
          reason: z.string(),
        })
      )
      .optional(),
    computedAt: z.union([z.string(), z.date()]).optional(),
  })
  .passthrough();

export const ModelRecommendationResponseSchema = z.object({
  success: z.boolean(),
  data: ModelRecommendationSchema.optional(),
  error: z.string().optional(),
  details: z.unknown().optional(),
});

export type ModelRecommendationResponse = z.infer<typeof ModelRecommendationResponseSchema>;
