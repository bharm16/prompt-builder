/**
 * EnhancementApi - API Service for Prompt Enhancement
 *
 * Handles all API calls related to prompt enhancement and suggestions
 */

import { postEnhancementSuggestions } from '@/api/enhancementSuggestionsApi';
import { SpanLabelingApi } from '@features/span-highlighting/api/spanLabelingApi';
import { extractSceneContext } from '@/utils/sceneChange/sceneContextParser';
import { detectSceneChange as detectSceneChangeRequest } from '@/utils/sceneChange/sceneChangeApi';
import { ApiClient } from './ApiClient';
import { trackSuggestionRequest } from './analytics';

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

interface LabelSpansParams {
  prompt: string;
  cacheId?: string | null;
  parserVersion?: string;
}

interface SceneChangeResponse {
  hasSceneChange: boolean;
  updatedPrompt: string;
}

interface LabelSpansResponse {
  spans: Array<{
    start: number;
    end: number;
    category: string;
    confidence: number;
  }>;
  meta: Record<string, unknown> | null;
  signature?: string;
}

const normalizeTemplateVersion = (parserVersion?: string): string | undefined => {
  if (!parserVersion || typeof parserVersion !== 'string') return undefined;
  const trimmed = parserVersion.trim();
  if (!trimmed) return undefined;
  if (!/^v\d/i.test(trimmed)) return undefined;
  return trimmed;
};

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
    trackSuggestionRequest(highlightedCategory || 'unknown');
    const data = await postEnhancementSuggestions({
      highlightedText,
      contextBefore,
      contextAfter,
      fullPrompt,
      originalUserPrompt,
      brainstormContext,
      highlightedCategory,
      highlightedCategoryConfidence,
      highlightedPhrase,
    });

    return {
      suggestions: data.suggestions || [],
      isPlaceholder: data.isPlaceholder || false,
    };
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
    const sourcePrompt = typeof originalPrompt === 'string' ? originalPrompt : '';
    const baselinePrompt =
      typeof updatedPrompt === 'string' ? updatedPrompt : sourcePrompt;
    const safeOldValue = typeof oldValue === 'string' ? oldValue : '';
    const safeNewValue = typeof newValue === 'string' ? newValue : '';
    const { changedField, affectedFields, sectionHeading, sectionContext } =
      extractSceneContext(sourcePrompt, safeOldValue);

    const result = await detectSceneChangeRequest({
      changedField: changedField || 'Unknown Field',
      oldValue: safeOldValue,
      newValue: safeNewValue,
      fullPrompt: baselinePrompt,
      affectedFields: affectedFields || {},
      ...(sectionHeading ? { sectionHeading } : {}),
      ...(sectionContext ? { sectionContext } : {}),
    });

    return {
      hasSceneChange: result?.isSceneChange === true,
      updatedPrompt: baselinePrompt,
    };
  }

  /**
   * Label text spans with categories
   */
  async labelSpans({
    prompt,
    cacheId = null,
    parserVersion = 'llm-v1',
  }: LabelSpansParams): Promise<LabelSpansResponse> {
    void cacheId;
    const templateVersion = normalizeTemplateVersion(parserVersion);
    const data = await SpanLabelingApi.labelSpans({
      text: prompt,
      ...(templateVersion ? { templateVersion } : {}),
    });

    return {
      spans: data.spans,
      meta: data.meta ?? null,
    };
  }
}

// Export singleton instance
import { apiClient } from './ApiClient';
export const enhancementApi = new EnhancementApi(apiClient);
