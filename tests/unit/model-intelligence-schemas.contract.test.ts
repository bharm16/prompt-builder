import { describe, expect, it } from 'vitest';

import {
  ModelRecommendationSchema,
  ModelRecommendationResponseSchema,
} from '#shared/schemas/model-intelligence.schemas';

describe('ModelRecommendation contract', () => {
  const minimalRecommendation = {
    promptId: 'prompt-1',
    prompt: 'A cinematic dolly shot through a neon alley',
    recommendations: [
      {
        modelId: 'kling-1.6',
        overallScore: 87,
      },
    ],
    recommended: {
      modelId: 'kling-1.6',
      reasoning: 'Best overall match for cinematic camera movements',
    },
    suggestComparison: false,
  };

  it('accepts a minimal recommendation', () => {
    expect(ModelRecommendationSchema.safeParse(minimalRecommendation).success).toBe(true);
  });

  it('accepts a fully populated recommendation', () => {
    const result = ModelRecommendationSchema.safeParse({
      ...minimalRecommendation,
      requirements: {
        physics: {
          hasComplexPhysics: false,
          hasParticleSystems: false,
          hasFluidDynamics: false,
          hasSoftBodyPhysics: false,
          physicsComplexity: 'none',
        },
        character: {
          hasHumanCharacter: true,
          hasAnimalCharacter: false,
          hasMechanicalCharacter: false,
          requiresFacialPerformance: false,
          requiresBodyLanguage: true,
          requiresLipSync: false,
          emotionalIntensity: 'subtle',
        },
        environment: {
          complexity: 'moderate',
          type: 'exterior',
          hasArchitecture: true,
          hasNature: false,
          hasUrbanElements: true,
        },
        lighting: {
          requirements: 'stylized',
          complexity: 'moderate',
          hasPracticalLights: true,
          requiresAtmospherics: true,
        },
        style: {
          isPhotorealistic: true,
          isStylized: false,
          isAbstract: false,
          requiresCinematicLook: true,
          hasSpecificAesthetic: 'neo-noir',
        },
        motion: {
          cameraComplexity: 'moderate',
          subjectComplexity: 'simple',
          hasMorphing: false,
          hasTransitions: false,
        },
        detectedCategories: ['camera', 'lighting', 'location'],
        confidenceScore: 0.92,
      },
      recommendations: [
        {
          modelId: 'kling-1.6',
          overallScore: 87,
          factorScores: [
            {
              factor: 'camera',
              label: 'Camera Movement',
              weight: 0.3,
              capability: 0.9,
              contribution: 27,
              explanation: 'Excellent dolly tracking',
            },
          ],
          strengths: ['Strong camera work', 'Good lighting'],
          weaknesses: ['Limited physics'],
          warnings: [],
        },
      ],
      recommended: {
        modelId: 'kling-1.6',
        confidence: 'high',
        reasoning: 'Best for cinematic motion',
      },
      alsoConsider: {
        modelId: 'sora-2',
        confidence: 'medium',
        reasoning: 'Alternative with broader capabilities',
      },
      suggestComparison: true,
      comparisonModels: ['kling-1.6', 'sora-2'],
      filteredOut: [{ modelId: 'luma-ray2', reason: 'No dolly support' }],
      computedAt: '2025-06-15T10:00:00Z',
    });

    expect(result.success).toBe(true);
  });

  it('allows unknown additional properties (forward-compatible)', () => {
    const result = ModelRecommendationSchema.safeParse({
      ...minimalRecommendation,
      futureField: 'new-data',
    });

    expect(result.success).toBe(true);
  });

  it('rejects recommendations missing required fields', () => {
    expect(ModelRecommendationSchema.safeParse({ promptId: 'x' }).success).toBe(false);
    expect(
      ModelRecommendationSchema.safeParse({
        promptId: 'x',
        prompt: 'y',
        recommendations: [],
        // missing: recommended, suggestComparison
      }).success
    ).toBe(false);
  });
});

describe('ModelRecommendationResponse contract', () => {
  it('accepts a success response', () => {
    const result = ModelRecommendationResponseSchema.safeParse({
      success: true,
      data: {
        promptId: 'p1',
        prompt: 'test',
        recommendations: [],
        recommended: { modelId: 'sora-2', reasoning: 'Best match' },
        suggestComparison: false,
      },
    });

    expect(result.success).toBe(true);
  });

  it('accepts an error response', () => {
    const result = ModelRecommendationResponseSchema.safeParse({
      success: false,
      error: 'Analysis failed',
      details: { reason: 'prompt too short' },
    });

    expect(result.success).toBe(true);
  });
});
