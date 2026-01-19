import type { GenerationMediaType } from '../types';

type ModelConfig = {
  label: string;
  cost: number;
  eta: string;
  mediaType: GenerationMediaType;
  frameCount?: number;
};

export const DRAFT_MODELS: Record<string, ModelConfig> = {
  'flux-kontext': {
    label: 'Kontext',
    cost: 8,
    eta: '20s',
    mediaType: 'image-sequence',
    frameCount: 4,
  },
  'wan-2.2': {
    label: 'WAN 2.2',
    cost: 18,
    eta: '45s',
    mediaType: 'video',
  },
};

export const RENDER_MODELS: Record<string, ModelConfig> = {
  sora: { label: 'Sora', cost: 320, eta: '2-4m', mediaType: 'video' },
  veo: { label: 'Veo', cost: 260, eta: '2-3m', mediaType: 'video' },
  runway: { label: 'Runway', cost: 140, eta: '90s', mediaType: 'video' },
  kling: { label: 'Kling', cost: 150, eta: '2m', mediaType: 'video' },
  luma: { label: 'Luma', cost: 120, eta: '75s', mediaType: 'video' },
};

export const getModelConfig = (modelId: string): ModelConfig | null => {
  if (modelId in DRAFT_MODELS) return DRAFT_MODELS[modelId];
  if (modelId in RENDER_MODELS) return RENDER_MODELS[modelId];
  return null;
};

export const formatCost = (cents?: number | null): string => {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  const dollars = cents / 100;
  if (dollars < 1) return `$${dollars.toFixed(2)}`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    dollars
  );
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
