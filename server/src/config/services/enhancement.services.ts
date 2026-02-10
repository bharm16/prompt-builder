import type { DIContainer } from '@infrastructure/DIContainer';
import type {
  MetricsService as EnhancementMetricsService,
  VideoService,
} from '@services/enhancement/services/types';
import { AIModelService } from '@services/ai-model/index';
import { EnhancementService } from '@services/EnhancementService';
import { BrainstormContextBuilder } from '@services/enhancement/services/BrainstormContextBuilder';
import { CategoryAlignmentService } from '@services/enhancement/services/CategoryAlignmentService';
import { CleanPromptBuilder } from '@services/enhancement/services/CleanPromptBuilder';
import { PromptCoherenceService } from '@services/enhancement/services/PromptCoherenceService';
import { SuggestionDiversityEnforcer } from '@services/enhancement/services/SuggestionDeduplicator';
import { SuggestionValidationService } from '@services/enhancement/services/SuggestionValidationService';
import { ImageObservationService } from '@services/image-observation';
import { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';
import { SceneChangeDetectionService } from '@services/video-concept/services/detection/SceneChangeDetectionService';
import { VideoPromptService } from '@services/video-prompt-analysis/index';
import { VideoConceptService } from '@services/VideoConceptService';

export function registerEnhancementServices(container: DIContainer): void {
  container.register('videoService', () => new VideoPromptService(), []);
  container.register('brainstormBuilder', () => new BrainstormContextBuilder(), []);
  container.register('promptBuilder', () => new CleanPromptBuilder(), []);

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
      videoService: VideoPromptService,
      imageObservationService: ImageObservationService
    ) =>
      new PromptOptimizationService(aiService, videoService, imageObservationService),
    ['aiService', 'videoService', 'imageObservationService']
  );

  container.register(
    'imageObservationService',
    (aiService: AIModelService) => new ImageObservationService(aiService),
    ['aiService']
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
      metrics: EnhancementMetricsService
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
    ]
  );

  container.register(
    'sceneDetectionService',
    (aiService: AIModelService) => new SceneChangeDetectionService(aiService),
    ['aiService']
  );

  container.register(
    'promptCoherenceService',
    (aiService: AIModelService) => new PromptCoherenceService(aiService),
    ['aiService']
  );

  container.register(
    'videoConceptService',
    (aiService: AIModelService) => new VideoConceptService(aiService),
    ['aiService']
  );
}
