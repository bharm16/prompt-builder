import { afterEach, describe, expect, it, vi, type MockedFunction } from 'vitest';
import { ModelIntelligenceService } from '../ModelIntelligenceService';
import { ModelCapabilityRegistry } from '../services/ModelCapabilityRegistry';
import { ModelScoringService } from '../services/ModelScoringService';
import { PromptRequirementsService } from '../services/PromptRequirementsService';
import { RecommendationExplainerService } from '../services/RecommendationExplainerService';
import { AvailabilityGateService } from '../services/AvailabilityGateService';
import { SAMPLE_PROMPT, SAMPLE_SPANS } from './fixtures/testPrompts';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { VideoAvailabilitySnapshot, VideoAvailabilitySnapshotModel } from '@services/video-generation/types';
import { labelSpans } from '@llm/span-labeling/SpanLabelingService';

vi.mock('@llm/span-labeling/SpanLabelingService', () => ({
  labelSpans: vi.fn(),
}));

const mockedLabelSpans = labelSpans as MockedFunction<typeof labelSpans>;

describe('ModelIntelligenceService (integration)', () => {
  afterEach(() => {
    mockedLabelSpans.mockReset();
  });

  it('generates recommendations using labeled spans', async () => {
    mockedLabelSpans.mockResolvedValue({
      spans: SAMPLE_SPANS,
      meta: { version: 'test', notes: 'mocked' },
    });

    const registry = new ModelCapabilityRegistry();
    const modelIds = registry.getAllModels();
    const models: VideoAvailabilitySnapshotModel[] = modelIds.map((id) => ({
      id,
      available: true,
      supportsI2V: true,
      supportsImageInput: true,
      entitled: true,
      planTier: 'unknown',
    }));

    const snapshot: VideoAvailabilitySnapshot = {
      models,
      availableModelIds: modelIds,
      unknownModelIds: [],
    };

    const videoGenerationService = {
      getAvailabilitySnapshot: vi.fn().mockReturnValue(snapshot),
    } as unknown as VideoGenerationService;

    const aiService = { execute: vi.fn<AIModelService['execute']>() } as unknown as AIModelService;

    const service = new ModelIntelligenceService({
      aiService,
      videoGenerationService,
      userCreditService: null,
      requirementsService: new PromptRequirementsService(),
      registry,
      scoringService: new ModelScoringService(),
      explainerService: new RecommendationExplainerService(),
      availabilityGate: new AvailabilityGateService(videoGenerationService, null),
    });

    const recommendation = await service.getRecommendation(SAMPLE_PROMPT, { mode: 't2v' });

    expect(mockedLabelSpans).toHaveBeenCalled();
    expect(recommendation.requirements.physics.hasParticleSystems).toBe(true);
    expect(recommendation.recommendations.length).toBeGreaterThan(0);
  });
});
