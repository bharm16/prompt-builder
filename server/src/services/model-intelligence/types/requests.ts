import type { ModelRecommendation, PromptSpan } from './domain';

export interface ModelRecommendationRequest {
  prompt: string;
  spans?: PromptSpan[];
  mode?: 't2v' | 'i2v';
  durationSeconds?: number;
}

export interface ModelRecommendationResponse {
  success: boolean;
  data?: ModelRecommendation;
  error?: string;
  details?: unknown;
}
