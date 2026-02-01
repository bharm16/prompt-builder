import type { DraftModel } from '@components/ToolSidebar/types';

type DraftVideoModel = Exclude<DraftModel, 'flux-kontext'>;

const DRAFT_MODEL_OPTIONS: Record<DraftVideoModel, { id: DraftVideoModel; label: string; cost: number }> = {
  'wan-2.2': {
    id: 'wan-2.2',
    label: 'Wan 2.2',
    cost: 5,
  },
  'wan-2.5': {
    id: 'wan-2.5',
    label: 'Wan 2.5',
    cost: 5,
  },
};

const resolveDraftModelId = (): DraftVideoModel => {
  const envValue = import.meta.env?.VITE_DRAFT_VIDEO_MODEL?.trim();
  if (envValue && envValue in DRAFT_MODEL_OPTIONS) {
    return envValue as DraftVideoModel;
  }
  return 'wan-2.5';
};

export const VIDEO_DRAFT_MODEL = DRAFT_MODEL_OPTIONS[resolveDraftModelId()];
export const VIDEO_DRAFT_MODELS = Object.values(DRAFT_MODEL_OPTIONS);

export const VIDEO_RENDER_MODELS = [
  { id: 'sora-2', label: 'Sora', cost: 80 },
  { id: 'kling-v2-1-master', label: 'Kling', cost: 35 },
  { id: 'google/veo-3', label: 'Veo', cost: 30 },
  { id: 'luma-ray3', label: 'Luma', cost: 40 },
];

export const IMAGE_MODEL = { id: 'replicate-flux-kontext-fast', label: 'Kontext', cost: 1 };

export const STORYBOARD_COST = 4;
