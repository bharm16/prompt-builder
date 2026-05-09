import { describe, expect, it, vi, type MockedFunction } from "vitest";
import { ModelIntelligenceService } from "../ModelIntelligenceService";
import type { ModelCapabilities, PromptSpan } from "../types";
import { VIDEO_MODELS } from "@config/modelConfig";
import type { ModelCapabilityRegistry } from "../services/ModelCapabilityRegistry";
import type { ModelScoringService } from "../services/ModelScoringService";
import type { PromptRequirementsService } from "../services/PromptRequirementsService";
import type { RecommendationExplainerService } from "../services/RecommendationExplainerService";
import type { AvailabilityGateService } from "../services/AvailabilityGateService";
import type { PromptSpanProvider } from "../ports/PromptSpanProvider";

type MockScoringService = {
  scoreModel: MockedFunction<ModelScoringService["scoreModel"]>;
};

type MockAvailabilityGate = {
  filterModels: MockedFunction<AvailabilityGateService["filterModels"]>;
};

describe("ModelIntelligenceService", () => {
  describe("core behavior", () => {
    it("selects a cheaper close-scoring model as the efficient option", async () => {
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
        speedTier: "medium",
        costTier: "medium",
        qualityTier: "standard",
      };

      const scoringService: MockScoringService = {
        scoreModel: vi.fn<ModelScoringService["scoreModel"]>((modelId) => ({
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
            physicsComplexity: "complex",
          },
          character: {
            hasHumanCharacter: false,
            hasAnimalCharacter: false,
            hasMechanicalCharacter: false,
            requiresFacialPerformance: false,
            requiresBodyLanguage: false,
            requiresLipSync: false,
            emotionalIntensity: "none",
          },
          environment: {
            complexity: "simple",
            type: "abstract",
            hasArchitecture: false,
            hasNature: false,
            hasUrbanElements: false,
          },
          lighting: {
            requirements: "dramatic",
            complexity: "simple",
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
            cameraComplexity: "static",
            subjectComplexity: "static",
            hasMorphing: false,
            hasTransitions: false,
          },
          detectedCategories: [],
          confidenceScore: 0.7,
        }),
      } as unknown as PromptRequirementsService;

      const explainerService = {
        explainRecommendation: () => "Top match.",
        explainEfficientOption: () => "Efficient alternative.",
      } as unknown as RecommendationExplainerService;

      const availabilityGate: MockAvailabilityGate = {
        filterModels: vi
          .fn<AvailabilityGateService["filterModels"]>()
          .mockResolvedValue({
            availableModelIds: [VIDEO_MODELS.VEO_3, VIDEO_MODELS.SORA_2],
            unknownModelIds: [],
            filteredOut: [],
            snapshot: null,
          }),
      };

      const spans: PromptSpan[] = [
        { text: "dramatic lighting", role: "lighting.cinematic" },
      ];
      const promptSpanProvider = {
        label: vi.fn<PromptSpanProvider["label"]>().mockResolvedValue(spans),
      };

      const service = new ModelIntelligenceService({
        promptSpanProvider,
        registry,
        scoringService: scoringService as unknown as ModelScoringService,
        requirementsService,
        explainerService,
        availabilityGate:
          availabilityGate as unknown as AvailabilityGateService,
      });

      const recommendation = await service.getRecommendation("prompt", {
        spans,
        durationSeconds: 8,
      });

      expect(recommendation.recommended.modelId).toBe(VIDEO_MODELS.VEO_3);
      expect(recommendation.alsoConsider?.modelId).toBe(VIDEO_MODELS.SORA_2);
      expect(scoringService.scoreModel).toHaveBeenCalledTimes(2);
      expect(availabilityGate.filterModels).toHaveBeenCalledTimes(1);
    });
  });

  // O4: confidence ladder must be honest about low-signal inputs.
  // Previously, recommendation.confidence was derived purely from score-gap
  // arithmetic — it could claim "high" on a 5-word prompt with no spans.
  // Now: when requirements.confidenceScore < 0.4 (no spans / very weak
  // single-span signal), the "high" label is downgraded to "medium".
  describe("confidence ladder is capped on low-signal inputs", () => {
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
      speedTier: "medium",
      costTier: "medium",
      qualityTier: "standard",
    };

    /** Reduce per-test verbosity: only override what each test varies. */
    const createBaseRequirements = (
      overrides: { confidenceScore?: number } = {},
    ) => ({
      physics: {
        hasComplexPhysics: false,
        hasParticleSystems: false,
        hasFluidDynamics: false,
        hasSoftBodyPhysics: false,
        physicsComplexity: "none" as const,
      },
      character: {
        hasHumanCharacter: false,
        hasAnimalCharacter: false,
        hasMechanicalCharacter: false,
        requiresFacialPerformance: false,
        requiresBodyLanguage: false,
        requiresLipSync: false,
        emotionalIntensity: "none" as const,
      },
      environment: {
        complexity: "simple" as const,
        type: "abstract" as const,
        hasArchitecture: false,
        hasNature: false,
        hasUrbanElements: false,
      },
      lighting: {
        requirements: "natural" as const,
        complexity: "simple" as const,
        hasPracticalLights: false,
        requiresAtmospherics: false,
      },
      style: {
        isPhotorealistic: false,
        isStylized: false,
        isAbstract: false,
        requiresCinematicLook: false,
        hasSpecificAesthetic: null,
      },
      motion: {
        cameraComplexity: "static" as const,
        subjectComplexity: "static" as const,
        hasMorphing: false,
        hasTransitions: false,
      },
      detectedCategories: [],
      confidenceScore: overrides.confidenceScore ?? 0.7,
    });

    /** Score arrangement that would naturally produce "high" confidence:
     *  top=95, second=70 → diff=25 (>= 15) and top >= 80 → "high". */
    const highConfidenceScores: MockScoringService = {
      scoreModel: vi.fn<ModelScoringService["scoreModel"]>((modelId) => ({
        modelId,
        overallScore: modelId === VIDEO_MODELS.VEO_3 ? 95 : 70,
        factorScores: [],
        strengths: [],
        weaknesses: [],
        warnings: [],
      })),
    };

    const buildService = (
      requirementsConfidence: number,
      scoringMock: MockScoringService = highConfidenceScores,
    ) => {
      const registry = {
        getAllModels: () => [VIDEO_MODELS.VEO_3, VIDEO_MODELS.SORA_2],
        getCapabilities: () => dummyCapabilities,
      } as unknown as ModelCapabilityRegistry;

      const requirementsService = {
        extractRequirements: () =>
          createBaseRequirements({ confidenceScore: requirementsConfidence }),
      } as unknown as PromptRequirementsService;

      const explainerService = {
        explainRecommendation: () => "Top match.",
        explainEfficientOption: () => "Efficient alternative.",
      } as unknown as RecommendationExplainerService;

      const availabilityGate: MockAvailabilityGate = {
        filterModels: vi
          .fn<AvailabilityGateService["filterModels"]>()
          .mockResolvedValue({
            availableModelIds: [VIDEO_MODELS.VEO_3, VIDEO_MODELS.SORA_2],
            unknownModelIds: [],
            filteredOut: [],
            snapshot: null,
          }),
      };

      const promptSpanProvider = {
        label: vi.fn<PromptSpanProvider["label"]>().mockResolvedValue([]),
      };

      return new ModelIntelligenceService({
        promptSpanProvider,
        registry,
        scoringService: scoringMock as unknown as ModelScoringService,
        requirementsService,
        explainerService,
        availabilityGate:
          availabilityGate as unknown as AvailabilityGateService,
      });
    };

    it("caps confidence at 'medium' when requirements.confidenceScore < 0.4 (no-spans path)", async () => {
      const service = buildService(0.3); // = floor when no spans

      const recommendation = await service.getRecommendation("short prompt", {
        durationSeconds: 8,
      });

      // Without the cap, the score arrangement (95 vs 70) yields "high".
      // With the cap, weak signal forces "medium".
      expect(recommendation.recommended.confidence).toBe("medium");
    });

    it("preserves 'high' confidence when requirements.confidenceScore >= 0.4 (good signal)", async () => {
      const service = buildService(0.8);

      const recommendation = await service.getRecommendation("rich prompt", {
        durationSeconds: 8,
      });

      expect(recommendation.recommended.confidence).toBe("high");
    });

    it("does not promote 'low' to anything else (the cap is a ceiling, not a setter)", async () => {
      // Score arrangement that yields naturally "low":
      // top=60, second=58 → diff=2 (< 8) and top < 70 → "low"
      const lowGapScores: MockScoringService = {
        scoreModel: vi.fn<ModelScoringService["scoreModel"]>((modelId) => ({
          modelId,
          overallScore: modelId === VIDEO_MODELS.VEO_3 ? 60 : 58,
          factorScores: [],
          strengths: [],
          weaknesses: [],
          warnings: [],
        })),
      };
      const service = buildService(0.8, lowGapScores); // good signal, but low score gap

      const recommendation = await service.getRecommendation("ambiguous", {
        durationSeconds: 8,
      });

      expect(recommendation.recommended.confidence).toBe("low");
    });
  });
});
