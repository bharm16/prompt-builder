import type { GenerationMediaType } from "../types";
import {
  DEFAULT_GENERATION_DURATION_SECONDS,
  getGenerationCreditCost,
  getGenerationCreditsPerSecond,
} from "@shared/generationPricing";

type ModelConfig = {
  label: string;
  /** Static credit cost at the default 8-second duration. For duration-aware cost, use getModelCreditCost(). */
  credits: number;
  /** Per-second credit rate. Present on video models; absent on flat-rate models like flux-kontext. */
  creditsPerSecond?: number | undefined;
  eta: string;
  mediaType: GenerationMediaType;
  frameCount?: number | undefined;
};

/**
 * Default duration used when computing credit cost without an explicit duration.
 * Must match server/src/config/modelCosts.ts DEFAULT_VIDEO_DURATION_SECONDS
 * and client/src/components/ToolSidebar/config/modelConfig.ts.
 */
const DEFAULT_VIDEO_DURATION_SECONDS = DEFAULT_GENERATION_DURATION_SECONDS;

export const DRAFT_MODELS: Record<string, ModelConfig> = {
  "flux-kontext": {
    label: "Kontext",
    credits: 4,
    eta: "20s",
    mediaType: "image-sequence",
    frameCount: 4,
  },
  "wan-2.2": {
    label: "WAN 2.2",
    creditsPerSecond: getGenerationCreditsPerSecond("wan-2.2") ?? 3.5,
    credits: getGenerationCreditCost("wan-2.2", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "45s",
    mediaType: "video",
  },
  "wan-2.5": {
    label: "WAN 2.5",
    creditsPerSecond: getGenerationCreditsPerSecond("wan-2.5") ?? 3.5,
    credits: getGenerationCreditCost("wan-2.5", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "45s",
    mediaType: "video",
  },
};

/**
 * Per-second credit rates MUST match server/src/config/modelCosts.ts
 * and client/src/components/ToolSidebar/config/modelConfig.ts.
 */
export const RENDER_MODELS: Record<string, ModelConfig> = {
  "sora-2": {
    label: "Sora",
    creditsPerSecond: getGenerationCreditsPerSecond("sora-2") ?? 6,
    credits: getGenerationCreditCost("sora-2", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "2-4m",
    mediaType: "video",
  },
  "kling-v2-1-master": {
    label: "Kling",
    creditsPerSecond: getGenerationCreditsPerSecond("kling-v2-1-master") ?? 5,
    credits: getGenerationCreditCost(
      "kling-v2-1-master",
      DEFAULT_VIDEO_DURATION_SECONDS,
    ),
    eta: "2m",
    mediaType: "video",
  },
  "google/veo-3": {
    label: "Veo",
    creditsPerSecond: getGenerationCreditsPerSecond("google/veo-3") ?? 24,
    credits: getGenerationCreditCost(
      "google/veo-3",
      DEFAULT_VIDEO_DURATION_SECONDS,
    ),
    eta: "2-3m",
    mediaType: "video",
  },
  "luma-ray3": {
    label: "Luma",
    creditsPerSecond: getGenerationCreditsPerSecond("luma-ray3") ?? 7,
    credits: getGenerationCreditCost(
      "luma-ray3",
      DEFAULT_VIDEO_DURATION_SECONDS,
    ),
    eta: "75s",
    mediaType: "video",
  },
  sora: {
    label: "Sora",
    creditsPerSecond: getGenerationCreditsPerSecond("sora") ?? 6,
    credits: getGenerationCreditCost("sora", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "2-4m",
    mediaType: "video",
  },
  veo: {
    label: "Veo",
    creditsPerSecond: getGenerationCreditsPerSecond("veo") ?? 24,
    credits: getGenerationCreditCost("veo", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "2-3m",
    mediaType: "video",
  },
  runway: {
    label: "Runway",
    creditsPerSecond: getGenerationCreditsPerSecond("runway") ?? 6,
    credits: getGenerationCreditCost("runway", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "90s",
    mediaType: "video",
  },
  kling: {
    label: "Kling",
    creditsPerSecond: getGenerationCreditsPerSecond("kling") ?? 5,
    credits: getGenerationCreditCost("kling", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "2m",
    mediaType: "video",
  },
  luma: {
    label: "Luma",
    creditsPerSecond: getGenerationCreditsPerSecond("luma") ?? 7,
    credits: getGenerationCreditCost("luma", DEFAULT_VIDEO_DURATION_SECONDS),
    eta: "75s",
    mediaType: "video",
  },
};

export const getModelConfig = (modelId: string): ModelConfig | null => {
  const draftConfig = DRAFT_MODELS[modelId];
  if (draftConfig) return draftConfig;
  const renderConfig = RENDER_MODELS[modelId];
  if (renderConfig) return renderConfig;
  return null;
};

/**
 * Compute the credit cost for a model accounting for actual duration.
 * Per-second models: Math.ceil(creditsPerSecond × duration).
 * Flat-rate models (e.g., flux-kontext): returns static credits regardless of duration.
 */
export const getModelCreditCost = (
  modelId: string,
  durationSeconds?: number | null,
): number => {
  return getGenerationCreditCost(
    modelId,
    durationSeconds ?? DEFAULT_VIDEO_DURATION_SECONDS,
  );
};

export const formatCredits = (credits?: number | null): string => {
  if (credits === null || credits === undefined || Number.isNaN(credits))
    return "—";
  const formatted = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(credits);
  return `${formatted} credit${credits === 1 ? "" : "s"}`;
};

export const formatRelativeTime = (
  timestamp?: number | string | null,
): string => {
  if (!timestamp) return "—";
  const value =
    typeof timestamp === "string" ? Date.parse(timestamp) : timestamp;
  if (!Number.isFinite(value)) return "—";
  const seconds = Math.round((Date.now() - value) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "1m ago";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};
