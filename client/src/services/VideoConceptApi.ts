/**
 * VideoConceptApi - API Service for Video Concept Operations
 *
 * Handles all API calls related to video concept building and wizard
 */

import { ApiClient } from './ApiClient';

interface GetSuggestionsParams {
  elementType: string;
  currentValue?: string;
  context?: Record<string, unknown>;
  concept?: string;
}

interface SuggestionsResponse {
  suggestions: string[];
}

interface ValidatePromptParams {
  elements: Record<string, unknown>;
  concept?: string;
}

interface ValidatePromptResponse {
  score: number;
  feedback: string[];
  strengths: string[];
  weaknesses: string[];
}

interface CompatibilityResponse {
  compatible: boolean;
  issues: string[];
}

export class VideoConceptApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * Get suggestions for a specific video element
   */
  async getSuggestions({
    elementType,
    currentValue = '',
    context = {},
    concept = '',
  }: GetSuggestionsParams): Promise<SuggestionsResponse> {
    return this.client.post('/video/suggestions', {
      elementType,
      currentValue,
      context,
      concept,
    }) as Promise<SuggestionsResponse>;
  }

  /**
   * Validate video prompt completeness
   */
  async validatePrompt({
    elements,
    concept = '',
  }: ValidatePromptParams): Promise<ValidatePromptResponse> {
    return this.client.post('/video/validate', {
      elements,
      concept,
    }) as Promise<ValidatePromptResponse>;
  }

  /**
   * Get compatibility check for video elements
   */
  async checkCompatibility(
    elements: Record<string, unknown>
  ): Promise<CompatibilityResponse> {
    return this.client.post('/video/compatibility', {
      elements,
    }) as Promise<CompatibilityResponse>;
  }
}

// Export singleton instance
import { apiClient } from './ApiClient';
export const videoConceptApi = new VideoConceptApi(apiClient);

