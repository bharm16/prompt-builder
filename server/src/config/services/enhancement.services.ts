import type { DIContainer } from "@infrastructure/DIContainer";
import type { VideoService } from "@services/enhancement/services/types";
import { AIModelService } from "@services/ai-model/index";
import { EnhancementService } from "@services/enhancement/index";
import { BrainstormContextBuilder } from "@services/enhancement/services/BrainstormContextBuilder";
import { CategoryAlignmentService } from "@services/enhancement/services/CategoryAlignmentService";
import { CleanPromptBuilder } from "@services/enhancement/services/CleanPromptBuilder";
import { PromptCoherenceService } from "@services/enhancement/services/PromptCoherenceService";
import { SuggestionDiversityEnforcer } from "@services/enhancement/services/SuggestionDeduplicator";
import { SuggestionValidationService } from "@services/enhancement/services/SuggestionValidationService";
import { SceneChangeDetectionService } from "@services/enhancement/services/SceneChangeDetectionService";
import type { ImageObservationService } from "@services/image-observation";
import { PromptOptimizationService } from "@services/prompt-optimization/PromptOptimizationService";
import { TemplateService } from "@services/prompt-optimization/services/TemplateService";
import type { CacheService } from "@services/cache/CacheService";
import { VideoPromptService } from "@services/video-prompt-analysis/index";
import { AIServiceVideoPromptLlmGateway } from "@services/video-prompt-analysis/services/llm/VideoPromptLlmGateway";
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
}
