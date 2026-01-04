/**
 * Scene Change Detection and Application
 *
 * Detects scene changes via API and applies suggested updates to the prompt
 */

import { extractSceneContext } from './sceneContextParser.ts';
import { detectSceneChange } from './sceneChangeApi';
import { applySceneChangeUpdates } from './sceneChangeUpdates';
import type { SceneChangeParams } from './types';

const buildConfirmationMessage = (
  oldValue: string,
  newValue: string,
  reasoning?: string
): string =>
  `🎬 Scene Change Detected!\n\n` +
  `Changing from "${oldValue}" to "${newValue}" represents a complete environment change.\n\n` +
  `Would you like to automatically update the related location fields to match this new environment?\n\n` +
  `${reasoning || ''}`;

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

  if (!confirmSceneChange) {
    return baselinePrompt;
  }

  try {
    const result = await detectSceneChange(
      {
        changedField: changedField || 'Unknown Field',
        oldValue,
        newValue,
        fullPrompt: baselinePrompt,
        affectedFields: normalizedAffectedFields,
        sectionHeading,
        sectionContext,
      },
      fetchImpl
    );

    if (!result || !result.isSceneChange || result.confidence === 'low') {
      return baselinePrompt;
    }

    const confirmationMessage = buildConfirmationMessage(
      oldValue,
      newValue,
      result.reasoning
    );

    const shouldUpdate = confirmSceneChange(confirmationMessage);

    if (!shouldUpdate || !result.suggestedUpdates) {
      return baselinePrompt;
    }

    return applySceneChangeUpdates(
      baselinePrompt,
      result.suggestedUpdates,
      normalizedAffectedFields
    );
  } catch (error) {
    console.error('Error detecting scene change:', error);
    return baselinePrompt;
  }
}
