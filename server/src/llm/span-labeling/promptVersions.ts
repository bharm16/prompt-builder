/**
 * Prompt version constants for span labeling templates.
 *
 * Centralizes version identifiers so that changes are tracked in one place
 * and can be correlated with LLM metrics (operation + version → quality).
 */

export const PROMPT_VERSIONS = {
  /** Standard span labeling prompt (multi-provider) */
  SPAN_LABELING: 'span-v2.2',
  /** Image-to-video span labeling (motion-only categories) */
  I2V_SPAN_LABELING: 'i2v-v2',
  /** Gemini simple prompt variant */
  GEMINI_SIMPLE: 'gemini-simple-v1',
  /** Visual control points extraction */
  VISUAL_CONTROL_POINTS: 'vcp-v1',
  /** Role classifier prompt */
  ROLE_CLASSIFIER: 'role-v1',
} as const;

export type PromptVersion = typeof PROMPT_VERSIONS[keyof typeof PROMPT_VERSIONS];
