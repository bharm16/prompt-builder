import { VIDEO_DRAFT_MODEL, VIDEO_RENDER_MODELS } from '@/components/ToolSidebar/config/modelConfig';

const MODEL_LABELS = new Map<string, string>([
  [VIDEO_DRAFT_MODEL.id, VIDEO_DRAFT_MODEL.label],
  ...VIDEO_RENDER_MODELS.map((model) => [model.id, model.label] as const),
]);

const MODEL_ID_ALIASES = new Map<string, string>([
  ['wan-video/wan-2.2-t2v-fast', VIDEO_DRAFT_MODEL.id],
  ['wan-video/wan-2.2-i2v-fast', VIDEO_DRAFT_MODEL.id],
  ['wan-2.2', VIDEO_DRAFT_MODEL.id],
  ['kling-26', 'kling-v2-1-master'],
  ['veo-4', 'google/veo-3'],
  ['veo-3', 'google/veo-3'],
]);

const MODEL_LABEL_OVERRIDES = new Map<string, string>([
  ['sora-2-pro', 'Sora Pro'],
]);

const normalizeModelId = (modelId: string): string => MODEL_ID_ALIASES.get(modelId) ?? modelId;

export const normalizeModelIdForSelection = (modelId: string): string => normalizeModelId(modelId);

export const getModelLabel = (modelId: string): string => {
  if (MODEL_LABEL_OVERRIDES.has(modelId)) {
    return MODEL_LABEL_OVERRIDES.get(modelId) ?? modelId;
  }
  const normalized = normalizeModelId(modelId);
  return MODEL_LABELS.get(normalized) ?? modelId;
};
