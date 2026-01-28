/**
 * API Layer for Video Concept Builder
 *
 * Centralizes all API calls for video concept operations.
 * Each method returns a Promise that resolves with the API response data.
 * Uses Zod schemas for runtime validation at API boundaries.
 */

import {
  ValidationResultSchema,
  CompatibilityScoreSchema,
  ElementSuggestionsSchema,
  ParsedElementsSchema,
  RefinementSuggestionsSchema,
  TechnicalParamsSchema,
  CompleteSceneResponseSchema,
  type ValidationResult,
  type ElementSuggestions,
  type ParsedElements,
  type RefinementSuggestions,
  type TechnicalParams,
  type CompleteSceneResponse,
} from './schemas';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

/**
 * Base fetch wrapper with error handling
 * @private
 */
async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<unknown> {
  const authHeaders = await buildFirebaseAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Video Concept API
 */
export class VideoConceptApi {
  /**
   * Validates elements for compatibility and conflicts
   */
  static async validateElements(
    elements: Record<string, string>,
    elementType: string | null = null,
    value: string | null = null
  ): Promise<ValidationResult> {
    const body: Record<string, unknown> = { elements };
    if (elementType) body.elementType = elementType;
    if (value) body.value = value;

    const data = await apiFetch('/api/video/validate', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    return ValidationResultSchema.parse(data);
  }

  /**
   * Checks compatibility of a specific element value
   * @returns Compatibility score (0-1)
   */
  static async checkCompatibility(
    elementType: string,
    value: string,
    elements: Record<string, string>
  ): Promise<number> {
    const data = await apiFetch('/api/video/validate', {
      method: 'POST',
      body: JSON.stringify({
        elementType,
        value,
        elements,
      }),
    });

    const parsed = CompatibilityScoreSchema.safeParse(data);
    if (parsed.success) {
      return parsed.data.score;
    }

    // Fallback: try to extract from nested structure
    const validationResult = ValidationResultSchema.safeParse(data);
    if (validationResult.success && validationResult.data.compatibility) {
      return validationResult.data.compatibility.score;
    }

    return 0.5; // Default score
  }

  /**
   * Fetches AI suggestions for an element
   */
  static async fetchSuggestions(
    elementType: string,
    currentValue: string,
    context: Record<string, string>,
    concept: string,
    signal: AbortSignal | null = null
  ): Promise<ElementSuggestions> {
    const data = await apiFetch('/api/video/suggestions', {
      method: 'POST',
      body: JSON.stringify({
        elementType,
        currentValue,
        context,
        concept,
      }),
      ...(signal ? { signal } : {}),
    });

    const parsed = ElementSuggestionsSchema.safeParse(data);
    if (parsed.success) {
      return parsed.data;
    }

    // Handle nested response structure
    if (
      typeof data === 'object' &&
      data !== null &&
      'suggestions' in data &&
      Array.isArray((data as { suggestions?: unknown }).suggestions)
    ) {
      const nested = ElementSuggestionsSchema.safeParse(
        (data as { suggestions: unknown }).suggestions
      );
      if (nested.success) {
        return nested.data;
      }
    }

    return [];
  }

  /**
   * Auto-completes a scene with AI-generated elements
   */
  static async completeScene(
    existingElements: Record<string, string>,
    concept: string
  ): Promise<ParsedElements> {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({
        existingElements,
        concept,
      }),
    });

    const parsed = CompleteSceneResponseSchema.safeParse(data);
    if (parsed.success && parsed.data.suggestions) {
      return parsed.data.suggestions;
    }

    return {};
  }

  /**
   * Parses a concept description into structured elements
   */
  static async parseConcept(concept: string): Promise<ParsedElements> {
    const data = await apiFetch('/api/video/parse', {
      method: 'POST',
      body: JSON.stringify({ concept }),
    });

    const parsed = ParsedElementsSchema.safeParse(
      (data as { elements?: unknown })?.elements
    );
    if (parsed.success) {
      return parsed.data;
    }

    return {};
  }

  /**
   * Fetches refinement suggestions for existing elements
   */
  static async fetchRefinements(
    existingElements: Record<string, string>
  ): Promise<RefinementSuggestions> {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({ existingElements }),
    });

    const parsed = CompleteSceneResponseSchema.safeParse(data);
    if (parsed.success) {
      return (
        parsed.data.smartDefaults?.refinements ??
        parsed.data.refinements ??
        {}
      );
    }

    return {};
  }

  /**
   * Generates technical parameters based on creative elements
   */
  static async generateTechnicalParams(
    existingElements: Record<string, string>
  ): Promise<TechnicalParams> {
    const data = await apiFetch('/api/video/complete', {
      method: 'POST',
      body: JSON.stringify({
        existingElements,
        smartDefaultsFor: 'technical',
      }),
    });

    const parsed = CompleteSceneResponseSchema.safeParse(data);
    if (parsed.success) {
      return (
        parsed.data.smartDefaults?.technical ??
        parsed.data.smartDefaults ??
        parsed.data.technicalParams ??
        {}
      );
    }

    return {};
  }
}
