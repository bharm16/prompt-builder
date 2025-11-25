/**
 * Scene Change Detection and Application
 * 
 * Detects scene changes via API and applies suggested updates to the prompt
 */

import { API_CONFIG } from '@config/api.config.ts';
import { extractSceneContext } from './sceneContextParser.ts';

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultConfirm = (message: string): boolean => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
};

interface SceneChangeParams {
  originalPrompt: string | null | undefined;
  updatedPrompt: string | null | undefined;
  oldValue: string | null | undefined;
  newValue: string | null | undefined;
  fetchImpl?: typeof fetch;
  confirmSceneChange?: (message: string) => boolean;
}

interface SceneChangeResponse {
  isSceneChange?: boolean;
  confidence?: 'low' | 'medium' | 'high';
  reasoning?: string;
  suggestedUpdates?: Record<string, string>;
}

/**
 * Detect and apply scene changes to a prompt
 */
export async function detectAndApplySceneChange({
  originalPrompt,
  updatedPrompt,
  oldValue,
  newValue,
  fetchImpl,
  confirmSceneChange,
}: SceneChangeParams): Promise<string> {
  const sourcePrompt = typeof originalPrompt === 'string' ? originalPrompt : '';
  const baselinePrompt =
    typeof updatedPrompt === 'string' ? updatedPrompt : sourcePrompt;

  if (!sourcePrompt || !baselinePrompt) {
    return baselinePrompt || sourcePrompt;
  }

  if (!oldValue || !newValue || oldValue === newValue) {
    return baselinePrompt;
  }

  const {
    changedField,
    affectedFields,
    sectionHeading,
    sectionContext,
  } = extractSceneContext(sourcePrompt, oldValue);
  const normalizedAffectedFields = affectedFields || {};

  const fetchFn =
    fetchImpl || (typeof fetch !== 'undefined' ? fetch : undefined);

  if (!fetchFn) {
    return baselinePrompt;
  }

  const confirmFn = confirmSceneChange || defaultConfirm;

  try {
    const response = await fetchFn('/api/detect-scene-change', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_CONFIG.apiKey,
      },
      body: JSON.stringify({
        changedField: changedField || 'Unknown Field',
        oldValue,
        newValue,
        fullPrompt: baselinePrompt,
        affectedFields: normalizedAffectedFields,
        sectionHeading,
        sectionContext,
      }),
    });

    if (!response || !response.ok) {
      return baselinePrompt;
    }

    const result = (await response.json()) as SceneChangeResponse;

    if (!result || !result.isSceneChange || result.confidence === 'low') {
      return baselinePrompt;
    }

    const confirmationMessage =
      `🎬 Scene Change Detected!\n\n` +
      `Changing from "${oldValue}" to "${newValue}" represents a complete environment change.\n\n` +
      `Would you like to automatically update the related location fields to match this new environment?\n\n` +
      `${result.reasoning || ''}`;

    const shouldUpdate = confirmFn(confirmationMessage);

    if (!shouldUpdate || !result.suggestedUpdates) {
      return baselinePrompt;
    }

    let finalPrompt = baselinePrompt;

    Object.entries(result.suggestedUpdates).forEach(([fieldName, newFieldValue]) => {
      const oldFieldValue = normalizedAffectedFields[fieldName];

      if (!oldFieldValue || !newFieldValue) {
        return;
      }

      const pattern = new RegExp(
        `(- ${escapeRegExp(fieldName)}: \\[)${escapeRegExp(oldFieldValue)}(\\])`,
        'g'
      );

      finalPrompt = finalPrompt.replace(
        pattern,
        `$1${newFieldValue}$2`
      );
    });

    return finalPrompt;
  } catch (error) {
    console.error('Error detecting scene change:', error);
    return baselinePrompt;
  }
}

