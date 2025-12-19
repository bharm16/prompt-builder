/**
 * Video Model Constants
 * 
 * Defines video model identifiers, URLs, and display labels
 * for the model selection menu in PromptActions component.
 */

export const AI_MODEL_IDS = ['runway', 'sora', 'veo', 'kling'] as const;

export type AIModelId = typeof AI_MODEL_IDS[number];

export const AI_MODEL_URLS: Record<AIModelId, string> = {
  runway: 'https://runwayml.com/',
  sora: 'https://openai.com/sora',
  veo: 'https://deepmind.google/models/veo/',
  kling: 'https://kling.ai/',
} as const;

export const AI_MODEL_LABELS: Record<AIModelId, string> = {
  runway: 'Open Runway',
  sora: 'Open Sora',
  veo: 'Open Veo',
  kling: 'Open Kling',
} as const;

