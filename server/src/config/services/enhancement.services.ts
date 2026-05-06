import type { DIContainer } from "@infrastructure/DIContainer";
import type {
  MetricsService as EnhancementMetricsService,
  VideoService,
} from "@services/enhancement/services/types";
import { AIModelService } from "@services/ai-model/index";
import { EnhancementService } from "@services/enhancement/index";
import { BrainstormContextBuilder } from "@services/enhancement/services/BrainstormContextBuilder";
import { CategoryAlignmentService } from "@services/enhancement/services/CategoryAlignmentService";
import { CleanPromptBuilder } from "@services/enhancement/services/CleanPromptBuilder";
import { PromptCoherenceService } from "@services/enhancement/services/PromptCoherenceService";
import { SuggestionDiversityEnforcer } from "@services/enhancement/services/SuggestionDeduplicator";
import { SuggestionValidationService } from "@services/enhancement/services/SuggestionValidationService";
import type { ImageObservationService } from "@services/image-observation";
import { PromptOptimizationService } from "@services/prompt-optimization/PromptOptimizationService";
import { TemplateService } from "@services/prompt-optimization/services/TemplateService";
import { SceneChangeDetectionService } from "@services/video-concept/services/detection/SceneChangeDetectionService";
import type { CacheService } from "@services/cache/CacheService";
import { VideoPromptService } from "@services/video-prompt-analysis/index";
import { AIServiceVideoPromptLlmGateway } from "@services/video-prompt-analysis/services/llm/VideoPromptLlmGateway";
import {
  SuggestionGeneratorService,
  CompatibilityService,
  PreferenceRepository,
  SceneCompletionService,
  SceneVariationService,
  ConceptParsingService,
  RefinementService,
  TechnicalParameterService,
  PromptValidationService,
  ConflictDetectionService,
  VideoTemplateRepository,
} from "@services/video-concept/index";
import { VideoConceptService } from "@services/video-concept/VideoConceptService";
import type { ServiceConfig } from "./service-config.types.ts";

export function registerEnhancementServices(container: DIContainer): void {
  container.register(
    "videoPromptService",
    (aiService: AIModelService) =>
      new VideoPromptService({
        videoPromptLlmGateway: new AIServiceVideoPromptLlmGateway(aiService),
      }),
    ["aiService"],
  );
  container.register(
    "brainstormBuilder",
    () => new BrainstormContextBuilder(),
    [],
  );
  container.register("promptBuilder", () => new CleanPromptBuilder(), []);
  container.register("templateService", () => new TemplateService(), []);

  container.register(
    "validationService",
    (videoPromptService: VideoService) =>
      new SuggestionValidationService(videoPromptService),
    ["videoPromptService"],
  );

  container.register(
    "diversityEnforcer",
    (aiService: AIModelService) => new SuggestionDiversityEnforcer(aiService),
    ["aiService"],
  );

  container.register(
    "categoryAligner",
    (validationService: SuggestionValidationService) =>
      new CategoryAlignmentService(validationService),
    ["validationService"],
  );

  container.register(
    "promptOptimizationService",
    (
      aiService: AIModelService,
      cacheService: CacheService,
      videoPromptService: VideoPromptService,
      imageObservationService: ImageObservationService,
      templateService: TemplateService,
      config: ServiceConfig,
    ) => {
      const po = config.promptOptimization;
      return new PromptOptimizationService(
        aiService,
        cacheService,
        videoPromptService,
        imageObservationService,
        templateService,
        { cacheTtlMs: po.shotPlanCacheTtlMs, cacheMax: po.shotPlanCacheMax },
      );
    },
    [
      "aiService",
      "cacheService",
      "videoPromptService",
      "imageObservationService",
      "templateService",
      "config",
    ],
  );

  container.register(
    "enhancementService",
    (
      aiService: AIModelService,
      videoPromptService: VideoService,
      brainstormBuilder: BrainstormContextBuilder,
      promptBuilder: CleanPromptBuilder,
      validationService: SuggestionValidationService,
      diversityEnforcer: SuggestionDiversityEnforcer,
      categoryAligner: CategoryAlignmentService,
      metrics: EnhancementMetricsService,
      cacheService: CacheService,
      config: ServiceConfig,
    ) =>
      new EnhancementService({
        aiService,
        videoPromptService,
        brainstormBuilder,
        promptBuilder,
        validationService,
        diversityEnforcer,
        categoryAligner,
        metricsService: metrics,
        cacheService,
        enhancementConfig: config.enhancement,
      }),
    [
      "aiService",
      "videoPromptService",
      "brainstormBuilder",
      "promptBuilder",
      "validationService",
      "diversityEnforcer",
      "categoryAligner",
      "metricsService",
      "cacheService",
      "config",
    ],
  );

  container.register(
    "sceneDetectionService",
    (aiService: AIModelService, cacheService: CacheService) =>
      new SceneChangeDetectionService(aiService, cacheService),
    ["aiService", "cacheService"],
  );

  container.register(
    "promptCoherenceService",
    (aiService: AIModelService) => new PromptCoherenceService(aiService),
    ["aiService"],
  );

  // Video concept sub-services — registered individually so DI lifecycle is
  // real (prior to Phase 3γ these were self-instantiated inside a façade's
  // constructor, making them unmockable in route tests).
  container.register(
    "videoPreferenceRepository",
    () => new PreferenceRepository(),
    [],
  );

  container.register(
    "videoTemplateRepository",
    () => new VideoTemplateRepository(),
    [],
  );

  container.register(
    "videoCompatibilityService",
    (aiService: AIModelService, cacheService: CacheService) =>
      new CompatibilityService(aiService, cacheService),
    ["aiService", "cacheService"],
  );

  container.register(
    "videoSuggestionGeneratorService",
    (
      aiService: AIModelService,
      cacheService: CacheService,
      preferenceRepository: PreferenceRepository,
      compatibilityService: CompatibilityService,
    ) =>
      new SuggestionGeneratorService(
        aiService,
        cacheService,
        preferenceRepository,
        compatibilityService,
      ),
    [
      "aiService",
      "cacheService",
      "videoPreferenceRepository",
      "videoCompatibilityService",
    ],
  );

  container.register(
    "videoSceneCompletionService",
    (aiService: AIModelService) => new SceneCompletionService(aiService),
    ["aiService"],
  );

  container.register(
    "videoSceneVariationService",
    (aiService: AIModelService) => new SceneVariationService(aiService),
    ["aiService"],
  );

  container.register(
    "videoConceptParsingService",
    (aiService: AIModelService) => new ConceptParsingService(aiService),
    ["aiService"],
  );

  container.register(
    "videoRefinementService",
    (aiService: AIModelService) => new RefinementService(aiService),
    ["aiService"],
  );

  container.register(
    "videoTechnicalParameterService",
    (aiService: AIModelService) => new TechnicalParameterService(aiService),
    ["aiService"],
  );

  container.register(
    "videoPromptValidationService",
    (aiService: AIModelService) => new PromptValidationService(aiService),
    ["aiService"],
  );

  container.register(
    "videoConflictDetectionService",
    (aiService: AIModelService) => new ConflictDetectionService(aiService),
    ["aiService"],
  );

  // Aggregator façade consumed by /api/video/* route registration.
  // Without this, api.routes.ts silently drops the entire video namespace
  // because of the `if (videoConceptService)` mount guard.
  container.register(
    "videoConceptService",
    (aiService: AIModelService, cacheService: CacheService) =>
      new VideoConceptService(aiService, cacheService),
    ["aiService", "cacheService"],
  );
}
