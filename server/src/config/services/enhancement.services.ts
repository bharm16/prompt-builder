import type { DIContainer } from '@infrastructure/DIContainer';
import type {
  MetricsService as EnhancementMetricsService,
  VideoService,
} from '@services/enhancement/services/types';
import { AIModelService } from '@services/ai-model/index';
import { EnhancementService } from '@services/enhancement/index';
import { BrainstormContextBuilder } from '@services/enhancement/services/BrainstormContextBuilder';
import { CategoryAlignmentService } from '@services/enhancement/services/CategoryAlignmentService';
import { CleanPromptBuilder } from '@services/enhancement/services/CleanPromptBuilder';
import { PromptCoherenceService } from '@services/enhancement/services/PromptCoherenceService';
import { SuggestionDiversityEnforcer } from '@services/enhancement/services/SuggestionDeduplicator';
import { SuggestionValidationService } from '@services/enhancement/services/SuggestionValidationService';
import { ImageObservationService } from '@services/image-observation';
import { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';
import { TemplateService } from '@services/prompt-optimization/services/TemplateService';
import { LLMJudgeService } from '@services/quality-feedback/services/LLMJudgeService';
import { SceneChangeDetectionService } from '@services/video-concept/services/detection/SceneChangeDetectionService';
import type { CacheService } from '@services/cache/CacheService';
import { VideoPromptService } from '@services/video-prompt-analysis/index';
import { AIServiceVideoPromptLlmGateway } from '@services/video-prompt-analysis/services/llm/VideoPromptLlmGateway';
import { MultimodalAssetManager } from '@services/video-prompt-analysis/services/MultimodalAssetManager';
import { VideoConceptService } from '@services/video-concept/VideoConceptService';
import type { MetricsService } from '@infrastructure/MetricsService';
import type { ServiceConfig } from './service-config.types.ts';

export function registerEnhancementServices(container: DIContainer): void {
  container.register(
    'videoPromptLlmGateway',
    (aiService: AIModelService) => new AIServiceVideoPromptLlmGateway(aiService),
    ['aiService']
  );

  container.register(
    'videoService',
    (videoPromptLlmGateway: AIServiceVideoPromptLlmGateway, config: ServiceConfig) =>
      new VideoPromptService({ videoPromptLlmGateway, promptOutputOnly: config.features.promptOutputOnly }),
    ['videoPromptLlmGateway', 'config']
  );
  container.register('multimodalAssetManager', () => new MultimodalAssetManager(), []);
  container.register('brainstormBuilder', () => new BrainstormContextBuilder(), []);
  container.register('promptBuilder', () => new CleanPromptBuilder(), []);
  container.register('templateService', () => new TemplateService(), []);

  container.register(
    'validationService',
    (videoService: VideoService) => new SuggestionValidationService(videoService),
    ['videoService']
  );

  container.register(
    'diversityEnforcer',
    (aiService: AIModelService) => new SuggestionDiversityEnforcer(aiService),
    ['aiService']
  );

  container.register(
    'categoryAligner',
    (validationService: SuggestionValidationService) => new CategoryAlignmentService(validationService),
    ['validationService']
  );

  container.register(
    'promptOptimizationService',
    (
      aiService: AIModelService,
      cacheService: CacheService,
      videoService: VideoPromptService,
      imageObservationService: ImageObservationService,
      templateService: TemplateService,
      config: ServiceConfig,
      metricsService: MetricsService
    ) => {
      const po = config.promptOptimization;
      return new PromptOptimizationService(
        aiService,
        cacheService,
        videoService,
        imageObservationService,
        templateService,
        { cacheTtlMs: po.shotPlanCacheTtlMs, cacheMax: po.shotPlanCacheMax },
        metricsService
      );
    },
    ['aiService', 'cacheService', 'videoService', 'imageObservationService', 'templateService', 'config', 'metricsService']
  );

  container.register(
    'imageObservationService',
    (
      aiService: AIModelService,
      cacheService: CacheService
    ) => new ImageObservationService(aiService, cacheService),
    ['aiService', 'cacheService']
  );

  container.register(
    'enhancementService',
    (
      aiService: AIModelService,
      videoService: VideoService,
      brainstormBuilder: BrainstormContextBuilder,
      promptBuilder: CleanPromptBuilder,
      validationService: SuggestionValidationService,
      diversityEnforcer: SuggestionDiversityEnforcer,
      categoryAligner: CategoryAlignmentService,
      metrics: EnhancementMetricsService,
      cacheService: CacheService
    ) =>
      new EnhancementService({
        aiService,
        videoService,
        brainstormBuilder,
        promptBuilder,
        validationService,
        diversityEnforcer,
        categoryAligner,
        metricsService: metrics,
        cacheService,
      }),
    [
      'aiService',
      'videoService',
      'brainstormBuilder',
      'promptBuilder',
      'validationService',
      'diversityEnforcer',
      'categoryAligner',
      'metricsService',
      'cacheService',
    ]
  );

  container.register(
    'sceneDetectionService',
    (aiService: AIModelService, cacheService: CacheService) => new SceneChangeDetectionService(aiService, cacheService),
    ['aiService', 'cacheService']
  );

  container.register(
    'promptCoherenceService',
    (aiService: AIModelService) => new PromptCoherenceService(aiService),
    ['aiService']
  );

  container.register(
    'videoConceptService',
    (aiService: AIModelService, cacheService: CacheService) => new VideoConceptService(aiService, cacheService),
    ['aiService', 'cacheService']
  );

  container.register(
    'llmJudgeService',
    (aiService: AIModelService) => new LLMJudgeService(aiService),
    ['aiService'],
    { singleton: true }
  );
}
