import type { GenerationMediaType } from '../types';

type ModelConfig = {
  label: string;
  credits: number;
  eta: string;
  mediaType: GenerationMediaType;
  frameCount?: number | undefined;
};

export const DRAFT_MODELS: Record<string, ModelConfig> = {
  'flux-kontext': {
    label: 'Kontext',
    credits: 4,
    eta: '20s',
    mediaType: 'image-sequence',
    frameCount: 4,
  },
  'wan-2.2': {
    label: 'WAN 2.2',
    credits: 5,
    eta: '45s',
    mediaType: 'video',
  },
};

export const RENDER_MODELS: Record<string, ModelConfig> = {
  'sora-2': { label: 'Sora', credits: 80, eta: '2-4m', mediaType: 'video' },
  'kling-v2-1-master': { label: 'Kling', credits: 35, eta: '2m', mediaType: 'video' },
  'google/veo-3': { label: 'Veo', credits: 30, eta: '2-3m', mediaType: 'video' },
  'luma-ray3': { label: 'Luma', credits: 40, eta: '75s', mediaType: 'video' },
  sora: { label: 'Sora', credits: 80, eta: '2-4m', mediaType: 'video' },
  veo: { label: 'Veo', credits: 30, eta: '2-3m', mediaType: 'video' },
  runway: { label: 'Runway', credits: 40, eta: '90s', mediaType: 'video' },
  kling: { label: 'Kling', credits: 35, eta: '2m', mediaType: 'video' },
  luma: { label: 'Luma', credits: 40, eta: '75s', mediaType: 'video' },
};

export const getModelConfig = (modelId: string): ModelConfig | null => {
  const draftConfig = DRAFT_MODELS[modelId];
  if (draftConfig) return draftConfig;
  const renderConfig = RENDER_MODELS[modelId];
  if (renderConfig) return renderConfig;
  return null;
};

export const formatCredits = (credits?: number | null): string => {
  if (credits === null || credits === undefined || Number.isNaN(credits)) return '—';
  const formatted = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(
    credits
  );
  return `${formatted} credit${credits === 1 ? '' : 's'}`;
};

export const formatRelativeTime = (timestamp?: number | string | null): string => {
  if (!timestamp) return '—';
  const value = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp;
  if (!Number.isFinite(value)) return '—';
  const seconds = Math.round((Date.now() - value) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 90) return '1m ago';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};
