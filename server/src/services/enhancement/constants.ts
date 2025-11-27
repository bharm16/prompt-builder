/**
 * Constants for enhancement service
 * Following ARCHITECTURE_STANDARD.md - no magic strings
 */

export const PROMPT_MODES = {
  ENHANCEMENT: 'enhancement',
} as const;

export type PromptMode = typeof PROMPT_MODES[keyof typeof PROMPT_MODES];

/**
 * Patterns that indicate low-quality suggestions (from training data contamination)
 * These patterns suggest the model is repeating examples from its training data rather than
 * generating novel suggestions.
 */
export const POISONOUS_PATTERNS = [
  'specific element detail',
  'alternative aspect feature',
  'varied choice showcasing',
  'different variant featuring',
  'alternative option with specific',
  'distinctive',
  'remarkable',
  'notable',
] as const;

