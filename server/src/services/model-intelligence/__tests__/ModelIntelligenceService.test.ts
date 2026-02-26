import { describe, expect, it, vi, type MockedFunction } from 'vitest';
import { ModelIntelligenceService } from '../ModelIntelligenceService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { ModelCapabilities, PromptSpan } from '../types';
import { VIDEO_MODELS } from '@config/modelConfig';
import type { ModelCapabilityRegistry } from '../services/ModelCapabilityRegistry';
import type { ModelScoringService } from '../services/ModelScoringService';
import type { PromptRequirementsService } from '../services/PromptRequirementsService';
import type { RecommendationExplainerService } from '../services/RecommendationExplainerService';
import type { AvailabilityGateService } from '../services/AvailabilityGateService';

type MockScoringService = {
  scoreModel: MockedFunction<ModelScoringService['scoreModel']>;
};

type MockAvailabilityGate = {
  filterModels: MockedFunction<AvailabilityGateService['filterModels']>;
};

describe('ModelIntelligenceService', () => {
  describe('core behavior', () => {
    it('selects a cheaper close-scoring model as the efficient option', async () => {
      const dummyCapabilities: ModelCapabilities = {
        physics: 0.5,
        particleSystems: 0.5,
        fluidDynamics: 0.5,
        facialPerformance: 0.5,
        bodyLanguage: 0.5,
        characterActing: 0.5,
        cinematicLighting: 0.5,
        atmospherics: 0.5,
        environmentDetail: 0.5,
        architecturalAccuracy: 0.5,
        motionComplexity: 0.5,
        cameraControl: 0.5,
        stylization: 0.5,
        photorealism: 0.5,
        morphing: 0.5,
        transitions: 0.5,
        t2vBoost: 1,
        i2vBoost: 1,
        speedTier: 'medium',
        costTier: 'medium',
        qualityTier: 'standard',
      };

      const scoringService: MockScoringService = {
        scoreModel: vi.fn<ModelScoringService['scoreModel']>((modelId) => ({
          modelId,
          overallScore: modelId === VIDEO_MODELS.VEO_3 ? 92 : 90,
          factorScores: [],
          strengths: [],
          weaknesses: [],
          warnings: [],
        })),
      };

      const registry = {
        getAllModels: () => [VIDEO_MODELS.VEO_3, VIDEO_MODELS.SORA_2],
        getCapabilities: () => dummyCapabilities,
      } as unknown as ModelCapabilityRegistry;

      const requirementsService = {
        extractRequirements: () => ({
          physics: {
            hasComplexPhysics: true,
            hasParticleSystems: false,
            hasFluidDynamics: false,
            hasSoftBodyPhysics: false,
            physicsComplexity: 'complex',
          },
          character: {
            hasHumanCharacter: false,
            hasAnimalCharacter: false,
            hasMechanicalCharacter: false,
            requiresFacialPerformance: false,
            requiresBodyLanguage: false,
            requiresLipSync: false,
            emotionalIntensity: 'none',
          },
          environment: {
            complexity: 'simple',
            type: 'abstract',
            hasArchitecture: false,
            hasNature: false,
            hasUrbanElements: false,
          },
          lighting: {
            requirements: 'dramatic',
            complexity: 'simple',
            hasPracticalLights: false,
            requiresAtmospherics: true,
          },
          style: {
            isPhotorealistic: false,
            isStylized: true,
            isAbstract: false,
            requiresCinematicLook: false,
            hasSpecificAesthetic: null,
          },
          motion: {
            cameraComplexity: 'static',
            subjectComplexity: 'static',
            hasMorphing: false,
            hasTransitions: false,
          },
          detectedCategories: [],
          confidenceScore: 0.7,
        }),
      } as unknown as PromptRequirementsService;

      const explainerService = {
        explainRecommendation: () => 'Top match.',
        explainEfficientOption: () => 'Efficient alternative.',
      } as unknown as RecommendationExplainerService;

      const availabilityGate: MockAvailabilityGate = {
        filterModels: vi.fn<AvailabilityGateService['filterModels']>().mockResolvedValue({
          availableModelIds: [VIDEO_MODELS.VEO_3, VIDEO_MODELS.SORA_2],
          unknownModelIds: [],
          filteredOut: [],
          snapshot: null,
        }),
      };

      const aiService = { execute: vi.fn<AIModelService['execute']>() } as unknown as AIModelService;
      const spans: PromptSpan[] = [{ text: 'dramatic lighting', role: 'lighting.cinematic' }];

      const service = new ModelIntelligenceService({
        aiService,
        videoGenerationService: null,
        userCreditService: null,
        registry,
        scoringService: scoringService as unknown as ModelScoringService,
        requirementsService,
        explainerService,
        availabilityGate: availabilityGate as unknown as AvailabilityGateService,
      });

      const recommendation = await service.getRecommendation('prompt', {
        spans,
        durationSeconds: 8,
      });

      expect(recommendation.recommended.modelId).toBe(VIDEO_MODELS.VEO_3);
      expect(recommendation.alsoConsider?.modelId).toBe(VIDEO_MODELS.SORA_2);
      expect(scoringService.scoreModel).toHaveBeenCalledTimes(2);
      expect(availabilityGate.filterModels).toHaveBeenCalledTimes(1);
    });
  });
});
