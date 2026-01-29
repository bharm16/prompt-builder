import { apiClient } from '@/services/ApiClient';
import { logger } from '@/services/LoggingService';

export type ModelRecommendationEvent = {
  event: 'recommendation_viewed' | 'compare_opened' | 'model_selected' | 'generation_started';
  recommendationId?: string;
  promptId?: string;
  recommendedModelId?: string;
  selectedModelId?: string;
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
  timeSinceRecommendationMs?: number;
};

const log = logger.child('modelIntelligenceTelemetry');

export async function trackModelRecommendationEvent(event: ModelRecommendationEvent): Promise<void> {
  try {
    await apiClient.post('/model-intelligence/track', event);
  } catch (error) {
    log.debug('Model intelligence telemetry failed', {
      event: event.event,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
