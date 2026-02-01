/**
 * Video model identifiers and labels shared across features.
 */

export const AI_MODEL_IDS = [
  'runway-gen45',
  'luma-ray3',
  'sora-2',
  'veo-4',
  'kling-26',
  'wan-2.2',
  'wan-2.5',
] as const;

export type AIModelId = typeof AI_MODEL_IDS[number];

export const AI_MODEL_URLS: Record<AIModelId, string> = {
  'runway-gen45': 'https://runwayml.com/',
  'luma-ray3': 'https://lumalabs.ai/',
  'sora-2': 'https://openai.com/sora',
  'veo-4': 'https://deepmind.google/models/veo/',
  'kling-26': 'https://kling.ai/',
  'wan-2.2': 'https://wanvideo.alibaba.com/',
  'wan-2.5': 'https://wanvideo.alibaba.com/',
} as const;

export const AI_MODEL_LABELS: Record<AIModelId, string> = {
  'runway-gen45': 'Runway',
  'luma-ray3': 'Luma',
  'sora-2': 'Sora',
  'veo-4': 'Veo',
  'kling-26': 'Kling',
  'wan-2.2': 'Wan 2.2',
  'wan-2.5': 'Wan 2.5',
} as const;

export const AI_MODEL_PROVIDERS: Record<AIModelId, string> = {
  'runway-gen45': 'runway',
  'luma-ray3': 'luma',
  'sora-2': 'openai',
  'veo-4': 'google',
  'kling-26': 'kling',
  'wan-2.2': 'wan',
  'wan-2.5': 'wan',
} as const;

export type ModelMeta = {
  strength: string;
  badges: string[];
};

export const resolveModelMeta = (modelId: string): ModelMeta => {
  const id = modelId.toLowerCase();
  if (id.includes('sora')) {
    return { strength: 'Cinematic motion and high fidelity', badges: ['Cinematic', 'Photoreal'] };
  }
  if (id.includes('veo')) {
    return { strength: 'Strong lighting, realism, and camera', badges: ['Cinematic', 'Photoreal'] };
  }
  if (id.includes('kling')) {
    return { strength: 'Stable subjects and dynamic movement', badges: ['Cinematic', 'Character'] };
  }
  if (id.includes('luma')) {
    return { strength: 'Fast, clean previews with realism', badges: ['Fast', 'Photoreal'] };
  }
  if (id.includes('runway')) {
    return { strength: 'Quick iterations with strong style', badges: ['Fast', 'Cinematic'] };
  }
  if (id.includes('wan')) {
    return { strength: 'Speedy motion checks for iteration', badges: ['Fast', 'Balanced'] };
  }
  return { strength: 'Balanced preview defaults', badges: ['Balanced'] };
};
