/**
 * Scene Change Detection and Application
 * 
 * Detects scene changes via API and applies suggested updates to the prompt
 */

import { API_CONFIG } from '../../config/api.config.js';
import { extractSceneContext } from './sceneContextParser.js';

const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const defaultConfirm = (message) => {
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm(message);
  }
  return true;
};

/**
 * Detect and apply scene changes to a prompt
 * 
 * @param {Object} params
 * @param {string} params.originalPrompt - The original prompt text
 * @param {string} params.updatedPrompt - The updated prompt text
 * @param {string} params.oldValue - Previous field value
 * @param {string} params.newValue - New field value
 * @param {Function} params.fetchImpl - Fetch implementation (optional, defaults to global fetch)
 * @param {Function} params.confirmSceneChange - Confirmation function (optional, defaults to window.confirm)
 * @returns {Promise<string>} Updated prompt with scene changes applied
 */
export async function detectAndApplySceneChange({
  originalPrompt,
  updatedPrompt,
  oldValue,
  newValue,
  fetchImpl,
  confirmSceneChange,
}) {
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

    const result = await response.json();

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

