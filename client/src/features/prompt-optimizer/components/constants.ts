/**
 * Video Model Constants
 * 
 * Defines video model identifiers, URLs, and display labels
 * for the model selection menu in PromptActions component.
 */

export const AI_MODEL_IDS = ['runway', 'sora', 'veo', 'kling', 'wan'] as const;

export type AIModelId = typeof AI_MODEL_IDS[number];

export const AI_MODEL_URLS: Record<AIModelId, string> = {
  runway: 'https://runwayml.com/',
  sora: 'https://openai.com/sora',
  veo: 'https://deepmind.google/models/veo/',
  kling: 'https://kling.ai/',
  wan: 'https://wanvideo.alibaba.com/',
} as const;

export const AI_MODEL_LABELS: Record<AIModelId, string> = {
  runway: 'Open Runway',
  sora: 'Open Sora',
  veo: 'Open Veo',
  kling: 'Open Kling',
  wan: 'Open Wan 2.2',
} as const;

