import { logger } from '@infrastructure/Logger';
import { metricsService } from '@infrastructure/MetricsService';
import { getVideoCost } from '@config/modelCosts';
import { VIDEO_MODELS } from '@config/modelConfig';
import { labelSpans } from '@llm/span-labeling/SpanLabelingService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoModelId } from '@services/video-generation/types';
import type { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { ModelCapabilityRegistry } from './services/ModelCapabilityRegistry';
import { ModelScoringService } from './services/ModelScoringService';
import { PromptRequirementsService } from './services/PromptRequirementsService';
import { RecommendationExplainerService } from './services/RecommendationExplainerService';
import { AvailabilityGateService } from './services/AvailabilityGateService';
import type { ModelRecommendation, PromptRequirements, ModelScore, PromptSpan } from './types';

interface ModelIntelligenceDependencies {
  aiService: AIModelService;
  videoGenerationService: VideoGenerationService | null;
  userCreditService: UserCreditService | null;
  billingProfileStore?: BillingProfileStore | null;
  requirementsService?: PromptRequirementsService;
  registry?: ModelCapabilityRegistry;
  scoringService?: ModelScoringService;
  explainerService?: RecommendationExplainerService;
  availabilityGate?: AvailabilityGateService;
}

interface RecommendationOptions {
  mode?: 't2v' | 'i2v';
  spans?: PromptSpan[];
  durationSeconds?: number;
  userId?: string | null;
}

const log = logger.child({ service: 'ModelIntelligenceService' });

export class ModelIntelligenceService {
  private readonly requirementsService: PromptRequirementsService;
  private readonly registry: ModelCapabilityRegistry;
  private readonly scoringService: ModelScoringService;
  private readonly explainerService: RecommendationExplainerService;
  private readonly availabilityGate: AvailabilityGateService;

  constructor(private readonly deps: ModelIntelligenceDependencies) {
    this.requirementsService = deps.requirementsService ?? new PromptRequirementsService();
    this.registry = deps.registry ?? new ModelCapabilityRegistry();
    this.scoringService = deps.scoringService ?? new ModelScoringService();
    this.explainerService = deps.explainerService ?? new RecommendationExplainerService();
    this.availabilityGate =
      deps.availabilityGate ??
      new AvailabilityGateService(
        deps.videoGenerationService,
        deps.userCreditService,
        deps.billingProfileStore
      );
  }

  async getRecommendation(prompt: string, options: RecommendationOptions = {}): Promise<ModelRecommendation> {
    const startedAt = Date.now();
    const mode = options.mode ?? 't2v';
    const durationSeconds = options.durationSeconds ?? 8;

    let spans: PromptSpan[] = Array.isArray(options.spans) ? options.spans : [];

    if (!spans.length) {
      try {
        const result = await labelSpans({ text: prompt }, this.deps.aiService);
        spans = Array.isArray(result.spans) ? result.spans : [];
      } catch (error) {
        log.warn('Span labeling failed for model recommendation', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const requirements = this.requirementsService.extractRequirements(prompt, spans);
    const modelIds = this.registry.getAllModels();

    const availabilityOptions = {
      mode,
      durationSeconds,
      ...(options.userId !== undefined ? { userId: options.userId } : {}),
    };
    const availability = await this.availabilityGate.filterModels(modelIds, availabilityOptions);

    const availabilityState =
      availability.availableModelIds.length > 0
        ? 'available'
        : availability.unknownModelIds.length > 0
          ? 'unknown'
          : 'unavailable';

    metricsService.recordModelRecommendationRequest(mode, availabilityState);

    const candidateIds =
      availability.availableModelIds.length > 0
        ? availability.availableModelIds
        : availability.unknownModelIds;

    const recommendations = this.scoreModels(candidateIds, requirements, mode);
    const recommendedScore = recommendations[0];
    const recommended = this.determineRecommendation(recommendations, requirements, availabilityState);
    const alsoConsider = this.determineEfficientOption(recommendations, recommendedScore, durationSeconds);
    const comparison = this.shouldSuggestComparison(recommendations);

    if (!recommendedScore) {
      log.warn('No model scores available for recommendation', {
        promptLength: prompt.length,
        mode,
      });
    }

    log.info('Model recommendation computed', {
      durationMs: Date.now() - startedAt,
      promptLength: prompt.length,
      mode,
      availableCount: availability.availableModelIds.length,
      unknownCount: availability.unknownModelIds.length,
      recommendationCount: recommendations.length,
    });

    return {
      promptId: this.generatePromptId(),
      prompt,
      requirements,
      recommendations,
      recommended,
      suggestComparison: comparison.suggest,
      ...(alsoConsider ? { alsoConsider } : {}),
      ...(comparison.models ? { comparisonModels: comparison.models } : {}),
      ...(availability.filteredOut.length > 0 ? { filteredOut: availability.filteredOut } : {}),
      computedAt: new Date(),
    };
  }

  private scoreModels(
    modelIds: VideoModelId[],
    requirements: PromptRequirements,
    mode: 't2v' | 'i2v'
  ): ModelScore[] {
    return modelIds
      .map((modelId) => {
        const capabilities = this.registry.getCapabilities(modelId);
        if (!capabilities) return null;
        return this.scoringService.scoreModel(modelId, capabilities, requirements, mode);
      })
      .filter((score): score is ModelScore => Boolean(score))
      .sort((a, b) => b.overallScore - a.overallScore);
  }

  private determineRecommendation(
    scores: ModelScore[],
    requirements: PromptRequirements,
    availabilityState: 'available' | 'unknown' | 'unavailable'
  ): ModelRecommendation['recommended'] {
    const topScore = scores[0];
    const secondScore = scores[1];

    if (!topScore) {
      const fallbackModel = this.registry.getAllModels()[0] ?? VIDEO_MODELS.DRAFT;
      const reasoning =
        availabilityState === 'unavailable'
          ? 'No available models based on current credentials or entitlements.'
          : 'No scoring data available; defaulting to baseline model.';
      return {
        modelId: fallbackModel,
        confidence: 'low',
        reasoning,
      };
    }

    const scoreDiff = topScore.overallScore - (secondScore?.overallScore ?? 0);
    let confidence: 'high' | 'medium' | 'low';

    if (scoreDiff >= 15 && topScore.overallScore >= 80) {
      confidence = 'high';
    } else if (scoreDiff >= 8 || topScore.overallScore >= 70) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    const reasoning = this.explainerService.explainRecommendation(topScore, requirements);

    return {
      modelId: topScore.modelId,
      confidence,
      reasoning,
    };
  }

  private determineEfficientOption(
    scores: ModelScore[],
    recommendedScore: ModelScore | undefined,
    durationSeconds: number
  ): ModelRecommendation['alsoConsider'] | undefined {
    if (!recommendedScore || scores.length < 2) return undefined;

    const highScoreCutoff = 90;
    if (recommendedScore.overallScore < highScoreCutoff) return undefined;

    const threshold = 8;
    const candidates = scores.filter(
      (score) =>
        score.overallScore >= highScoreCutoff &&
        Math.abs(recommendedScore.overallScore - score.overallScore) <= threshold
    );

    if (candidates.length < 2) return undefined;

    const bestValue = candidates.reduce((best, current) => {
      const bestCost = getVideoCost(best.modelId, durationSeconds);
      const currentCost = getVideoCost(current.modelId, durationSeconds);

      if (currentCost < bestCost) return current;
      if (currentCost > bestCost) return best;

      const bestSpeed = this.getSpeedRank(best.modelId);
      const currentSpeed = this.getSpeedRank(current.modelId);

      if (currentSpeed > bestSpeed) return current;
      if (currentSpeed < bestSpeed) return best;

      return current.overallScore > best.overallScore ? current : best;
    }, recommendedScore);

    if (bestValue.modelId === recommendedScore.modelId) {
      return undefined;
    }

    return {
      modelId: bestValue.modelId,
      reasoning: this.explainerService.explainEfficientOption(bestValue),
    };
  }

  private getSpeedRank(modelId: VideoModelId): number {
    const capability = this.registry.getCapabilities(modelId);
    if (!capability) return 0;

    switch (capability.speedTier) {
      case 'fast':
        return 3;
      case 'medium':
        return 2;
      case 'slow':
        return 1;
      default:
        return 0;
    }
  }

  private shouldSuggestComparison(
    scores: ModelScore[]
  ): { suggest: boolean; models?: [VideoModelId, VideoModelId] } {
    if (scores.length < 2) return { suggest: false };

    const first = scores[0]!;
    const second = scores[1]!;
    const scoreDiff = first.overallScore - second.overallScore;

    if (scoreDiff < 12 && second.overallScore >= 65) {
      return { suggest: true, models: [first.modelId, second.modelId] };
    }

    return { suggest: false };
  }

  private generatePromptId(): string {
    return `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
