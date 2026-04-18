import type { DraftModel } from "@components/ToolSidebar/types";
import {
  getDefaultGenerationDurationSeconds,
  getGenerationCreditCost,
  getGenerationCreditsPerSecond,
} from "@shared/generationPricing";

type DraftVideoModel = Exclude<DraftModel, "flux-kontext">;

const DRAFT_MODEL_OPTIONS: Record<
  DraftVideoModel,
  { id: DraftVideoModel; label: string; creditsPerSecond: number }
> = {
  "wan-2.2": {
    id: "wan-2.2",
    label: "Wan 2.2",
    creditsPerSecond: getGenerationCreditsPerSecond("wan-2.2") ?? 3.5,
  },
  "wan-2.5": {
    id: "wan-2.5",
    label: "Wan 2.5",
    creditsPerSecond: getGenerationCreditsPerSecond("wan-2.5") ?? 3.5,
  },
};

export const VIDEO_DRAFT_MODEL = DRAFT_MODEL_OPTIONS["wan-2.5"];
export const VIDEO_DRAFT_MODELS = Object.values(DRAFT_MODEL_OPTIONS);

/**
 * Per-second credit rates for render-tier video models.
 * These MUST match the values in server/src/config/modelCosts.ts.
 */
export const VIDEO_RENDER_MODELS = [
  {
    id: "sora-2",
    label: "Sora",
    creditsPerSecond: getGenerationCreditsPerSecond("sora-2") ?? 6,
  },
  {
    id: "kling-v2-1-master",
    label: "Kling",
    creditsPerSecond: getGenerationCreditsPerSecond("kling-v2-1-master") ?? 5,
  },
  {
    id: "google/veo-3",
    label: "Veo",
    creditsPerSecond: getGenerationCreditsPerSecond("google/veo-3") ?? 24,
  },
  {
    id: "luma-ray3",
    label: "Luma",
    creditsPerSecond: getGenerationCreditsPerSecond("luma-ray3") ?? 7,
  },
];

export const IMAGE_MODEL = {
  id: "replicate-flux-kontext-fast",
  label: "Kontext",
  cost: 1,
};

export const STORYBOARD_COST = 4;

/**
 * Compute the credit cost for a video generation.
 * Delegates to the shared pricing contract so UI surfaces and gates stay aligned.
 */
export function getVideoCost(
  modelId: string,
  durationSeconds?: number,
): number {
  return getGenerationCreditCost(
    modelId,
    durationSeconds ?? getDefaultGenerationDurationSeconds(modelId),
  );
}
