/**
 * Validation Utilities for Video Concept Builder
 *
 * Contains logic for validating prompts and calculating quality scores.
 */

import { PRIMARY_ELEMENT_KEYS, ELEMENT_GROUPS } from '../config/constants';
import { buildComposedElements } from './subjectDescriptors';

/**
 * Validates prompt completeness and quality
 * @param {Object} elements - Current element values
 * @param {Array} conflicts - Array of detected conflicts
 * @returns {{score: number, feedback: string[]}} Validation score and feedback
 */
export function validatePrompt(elements, conflicts) {
  let score = 0;
  let feedback = [];

  const composed = buildComposedElements(elements);
  const filledCount = PRIMARY_ELEMENT_KEYS.filter((key) => composed[key]).length;

  // Completeness score (30 points)
  score += (filledCount / PRIMARY_ELEMENT_KEYS.length) * 30;

  // Conflict-free bonus (20 points)
  if (conflicts.length === 0) {
    score += 20;
  } else {
    feedback.push('Resolve conflicts for better coherence');
  }

  // Specificity score (20 points)
  const specificityScore = PRIMARY_ELEMENT_KEYS.filter(
    (key) => composed[key] && composed[key].length > 10
  ).length;
  score += (specificityScore / PRIMARY_ELEMENT_KEYS.length) * 20;

  // Core elements completion (20 points)
  const coreFilledCount = ELEMENT_GROUPS.core.filter((key) => composed[key]).length;
  if (coreFilledCount === ELEMENT_GROUPS.core.length) {
    score += 20;
  } else {
    feedback.push(`Fill ${ELEMENT_GROUPS.core.length - coreFilledCount} more core elements`);
  }

  // Style and mood bonus (10 points)
  if (composed.style && composed.mood) {
    score += 10;
    feedback.push('Good visual definition!');
  }

  return {
    score: Math.min(100, Math.round(score)),
    feedback
  };
}

/**
 * Calculates filled count by group
 * @param {Object} elements - Current element values
 * @returns {Object} Count of filled elements per group
 */
export function calculateFilledByGroup(elements) {
  const result = {};
  Object.entries(ELEMENT_GROUPS).forEach(([groupName, groupElements]) => {
    result[groupName] = groupElements.filter(el => elements[el]).length;
  });
  return result;
}

/**
 * Calculates group progress statistics
 * @param {Object} elements - Current element values
 * @returns {Array} Array of group progress objects
 */
export function calculateGroupProgress(elements) {
  return Object.entries(ELEMENT_GROUPS).map(([groupName, groupElements]) => {
    const filled = groupElements.filter((key) => elements[key]).length;
    return {
      key: groupName,
      label: groupName.replace(/([A-Z])/g, ' $1').trim().replace(/^./, (str) => str.toUpperCase()),
      filled,
      total: groupElements.length,
    };
  });
}
