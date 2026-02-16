import type { CapabilityValues } from '@shared/capabilities';
import type { VideoTier } from '@components/ToolSidebar/types';
import { sanitizeText } from '@/features/span-highlighting';
import type { Generation } from '@features/prompt-optimizer/GenerationsPanel/types';

interface ApplyGenerationReuseOptions {
  onInputPromptChange: (text: string) => void;
  onResetResultsForEditing?: (() => void) | undefined;
  setSelectedModel: (model: string) => void;
  setVideoTier: (tier: VideoTier) => void;
  setGenerationParams: (params: CapabilityValues) => void;
}

const REUSABLE_TIERS = new Set<VideoTier>(['draft', 'render']);

export function applyGenerationReuse(
  generation: Generation,
  options: ApplyGenerationReuseOptions
): boolean {
  const promptText = sanitizeText(generation.prompt ?? '').trim();
  if (!promptText) {
    return false;
  }

  options.onInputPromptChange(promptText);
  options.onResetResultsForEditing?.();

  const generationSettings = generation.generationSettings;
  const selectedModelValue =
    generationSettings?.selectedModel?.trim() ?? generation.model;
  if (selectedModelValue) {
    options.setSelectedModel(selectedModelValue);
  }

  const nextTier = generationSettings?.videoTier ?? generation.tier;
  if (nextTier && REUSABLE_TIERS.has(nextTier)) {
    options.setVideoTier(nextTier);
  }

  const nextGenerationParams: CapabilityValues = {
    ...((generationSettings?.generationParams ?? {}) as CapabilityValues),
  };

  const aspectRatio = generationSettings?.aspectRatio ?? generation.aspectRatio;
  if (aspectRatio) {
    nextGenerationParams.aspect_ratio = aspectRatio;
  }

  const duration = generationSettings?.duration ?? generation.duration;
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    nextGenerationParams.duration_s = duration;
  }

  const fps = generationSettings?.fps ?? generation.fps;
  if (typeof fps === 'number' && Number.isFinite(fps)) {
    nextGenerationParams.fps = fps;
  }

  options.setGenerationParams(nextGenerationParams);

  return true;
}
