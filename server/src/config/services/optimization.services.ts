import type { DIContainer } from "@infrastructure/DIContainer";
import type { AIExecutionPort } from "@services/ai-model/ports/AIExecutionPort";
import { PromptOptimizationService } from "@services/prompt-optimization/PromptOptimizationService";
import { TemplateService } from "@services/prompt-optimization/services/TemplateService";
import type { VideoPromptService } from "@services/video-prompt-analysis/VideoPromptService";
import type { ImageObservationService } from "@services/image-observation";
import type { CacheService } from "@services/cache/CacheService";
import type { ServiceConfig } from "./service-config.types.ts";

export function registerOptimizationServices(container: DIContainer): void {
  container.register("templateService", () => new TemplateService(), []);

  container.register(
    "promptOptimizationService",
    (
      aiService: AIExecutionPort,
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
}
