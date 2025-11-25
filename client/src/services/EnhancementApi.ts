/**
 * EnhancementApi - API Service for Prompt Enhancement
 *
 * Handles all API calls related to prompt enhancement and suggestions
 */

import { ApiClient } from './ApiClient';

interface GetSuggestionsParams {
  highlightedText: string;
  contextBefore: string;
  contextAfter: string;
  fullPrompt: string;
  originalUserPrompt: string;
  brainstormContext?: Record<string, unknown> | null;
  highlightedCategory?: string | null;
  highlightedCategoryConfidence?: number | null;
  highlightedPhrase?: string | null;
}

interface SuggestionsResponse {
  suggestions: string[];
  isPlaceholder: boolean;
}

interface DetectSceneChangeParams {
  originalPrompt: string;
  updatedPrompt: string;
  oldValue: string;
  newValue: string;
}

interface SceneChangeResponse {
  hasSceneChange: boolean;
  updatedPrompt: string;
}

interface LabelSpansParams {
  prompt: string;
  cacheId?: string | null;
  parserVersion?: string;
}

interface LabelSpansResponse {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown>;
  signature: string;
}

export class EnhancementApi {
  constructor(private readonly client: ApiClient) {}

  /**
   * Get enhancement suggestions for highlighted text
   */
  async getSuggestions({
    highlightedText,
    contextBefore,
    contextAfter,
    fullPrompt,
    originalUserPrompt,
    brainstormContext = null,
    highlightedCategory = null,
    highlightedCategoryConfidence = null,
    highlightedPhrase = null,
  }: GetSuggestionsParams): Promise<SuggestionsResponse> {
    return this.client.post('/get-enhancement-suggestions', {
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      originalUserPrompt,
      brainstormContext,
      highlightedCategory,
      highlightedCategoryConfidence,
      highlightedPhrase,
    }) as Promise<SuggestionsResponse>;
  }

  /**
   * Detect scene changes in a prompt
   */
  async detectSceneChange({
    originalPrompt,
    updatedPrompt,
    oldValue,
    newValue,
  }: DetectSceneChangeParams): Promise<SceneChangeResponse> {
    return this.client.post('/detect-scene-change', {
      originalPrompt,
      updatedPrompt,
      oldValue,
      newValue,
    }) as Promise<SceneChangeResponse>;
  }

  /**
   * Label text spans with categories
   */
  async labelSpans({
    prompt,
    cacheId = null,
    parserVersion = 'llm-v1',
  }: LabelSpansParams): Promise<LabelSpansResponse> {
    return this.client.post('/llm/label-spans', {
      prompt,
      cacheId,
      parserVersion,
    }) as Promise<LabelSpansResponse>;
  }
}

// Export singleton instance
import { apiClient } from './ApiClient';
export const enhancementApi = new EnhancementApi(apiClient);

