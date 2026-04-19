import type { DIContainer } from "@infrastructure/DIContainer";
import { AIModelService } from "@services/ai-model/index";
import type { CacheService } from "@services/cache/CacheService";
import { ImageObservationService } from "@services/image-observation";
import { LLMJudgeService } from "@services/quality-feedback/services/LLMJudgeService";

export function registerObservationServices(container: DIContainer): void {
  container.register(
    "imageObservationService",
    (aiService: AIModelService, cacheService: CacheService) =>
      new ImageObservationService(aiService, cacheService),
    ["aiService", "cacheService"],
  );

  container.register(
    "llmJudgeService",
    (aiService: AIModelService) => new LLMJudgeService(aiService),
    ["aiService"],
    { singleton: true },
  );
}
