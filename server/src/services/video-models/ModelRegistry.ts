import { VIDEO_MODELS } from "@config/modelConfig";
import {
  normalizePromptModelAlias,
  resolveCanonicalPromptModelId,
} from "@shared/videoModels";
import type {
  KlingModelId,
  LumaModelId,
  SoraModelId,
  VeoModelId,
  VideoModelId,
} from "@shared/videoModels";

// Derive `VideoModelKey` locally from the runtime config to avoid a circular
// type edge with `@services/video-generation`. This is the same type exported
// as `VideoModelKey` from `@services/video-generation/types`.
type VideoModelKey = keyof typeof VIDEO_MODELS;

type LogSink = {
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

const DEFAULT_VIDEO_MODEL = VIDEO_MODELS.PRO || "wan-video/wan-2.2-t2v-fast";
const VIDEO_MODEL_IDS = new Set<VideoModelId>(
  Object.values(VIDEO_MODELS) as VideoModelId[],
);
const VIDEO_MODEL_KEYS = new Set<VideoModelKey>(
  Object.keys(VIDEO_MODELS) as VideoModelKey[],
);

const GENERATION_MODEL_ALIASES: Record<string, VideoModelId> = {
  // Sora
  sora: "sora-2",
  "openai/sora-2": "sora-2",
  "sora-2": "sora-2",
  "sora-2-pro": "sora-2-pro",
  // Kling
  kling: "kling-v2-1-master",
  "kling-2.1": "kling-v2-1-master",
  "kling-v2.1": "kling-v2-1-master",
  "kling-26": "kling-v2-1-master",
  "kling-v2-1-master": "kling-v2-1-master",
  "kwaivgi/kling-v2.1": "kling-v2-1-master",
  // Veo
  veo: "google/veo-3",
  "google/veo-3": "google/veo-3",
  "veo-3": "google/veo-3",
  veo3: "google/veo-3",
  "veo-3.1": "google/veo-3",
  "veo-3.1-generate-preview": "google/veo-3",
  "veo-4": "google/veo-3",
  // Luma
  "luma-ray3": "luma-ray3",
  luma: "luma-ray3",
  // Wan
  wan: "wan-video/wan-2.2-t2v-fast",
  "wan-2.2": "wan-video/wan-2.2-t2v-fast",
  "wan-video/wan-2.2-t2v-fast": "wan-video/wan-2.2-t2v-fast",
  "wan-video/wan-2.2-i2v-fast": "wan-video/wan-2.2-i2v-fast",
  "wan-2.5": "wan-video/wan-2.5-i2v",
  "wan-video/wan-2.5-i2v": "wan-video/wan-2.5-i2v",
  "wan-video/wan-2.5-i2v-fast": "wan-video/wan-2.5-i2v-fast",
};
const normalizeAliasKey = normalizePromptModelAlias;

export type ModelResolutionSource = "default" | "key" | "alias" | "id";

export interface ModelResolution {
  modelId: VideoModelId;
  resolvedBy: ModelResolutionSource;
  requested?: string;
}

export function resolveGenerationModelSelection(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink,
): ModelResolution {
  if (
    !model ||
    (typeof model === "string" &&
      (model.trim().length === 0 || model.trim().toLowerCase() === "auto"))
  ) {
    return { modelId: DEFAULT_VIDEO_MODEL, resolvedBy: "default" };
  }

  const normalized = typeof model === "string" ? model.trim() : model;

  if (Object.prototype.hasOwnProperty.call(VIDEO_MODELS, normalized)) {
    return {
      modelId: VIDEO_MODELS[normalized as VideoModelKey],
      resolvedBy: "key",
      requested: String(model),
    };
  }

  if (VIDEO_MODEL_IDS.has(normalized as VideoModelId)) {
    return {
      modelId: normalized as VideoModelId,
      resolvedBy: "id",
      requested: String(model),
    };
  }

  if (typeof normalized === "string") {
    const alias = GENERATION_MODEL_ALIASES[normalizeAliasKey(normalized)];
    if (alias) {
      return {
        modelId: alias,
        resolvedBy: "alias",
        requested: normalized,
      };
    }
  }

  log?.warn("Unknown video model requested; falling back to default", {
    model,
  });
  return {
    modelId: DEFAULT_VIDEO_MODEL,
    resolvedBy: "default",
    requested: String(model),
  };
}

export function isKnownGenerationModelInput(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return false;
  }

  if (VIDEO_MODEL_KEYS.has(trimmed as VideoModelKey)) {
    return true;
  }

  if (VIDEO_MODEL_IDS.has(trimmed as VideoModelId)) {
    return true;
  }

  return Boolean(GENERATION_MODEL_ALIASES[normalizeAliasKey(trimmed)]);
}

export function resolveGenerationModelId(
  model?: VideoModelKey | VideoModelId | string,
  log?: LogSink,
): VideoModelId {
  return resolveGenerationModelSelection(model, log).modelId;
}

export function resolvePromptModelId(model?: string | null): string | null {
  if (!model || model.trim().length === 0) {
    return null;
  }
  return resolveCanonicalPromptModelId(model) ?? model.trim();
}

export function isOpenAISoraModelId(
  modelId: VideoModelId,
): modelId is SoraModelId {
  return modelId === VIDEO_MODELS.SORA_2 || modelId === VIDEO_MODELS.SORA_2_PRO;
}

export function isLumaModelId(modelId: VideoModelId): modelId is LumaModelId {
  return modelId === VIDEO_MODELS.LUMA_RAY3;
}

export function isKlingModelId(modelId: VideoModelId): modelId is KlingModelId {
  return modelId === VIDEO_MODELS.KLING_V2_1;
}

export function isVeoModelId(modelId: VideoModelId): modelId is VeoModelId {
  return modelId === VIDEO_MODELS.VEO_3;
}

export type VideoProviderName =
  | "openai"
  | "luma"
  | "kling"
  | "gemini"
  | "replicate";

/**
 * Single source of truth mapping every known video model ID to its provider.
 *
 * Declaring this as `Record<VideoModelId, VideoProviderName>` forces the
 * compiler to require an entry for every value in `VIDEO_MODELS`. When a new
 * model is added to the config, TypeScript will refuse to build until the
 * author assigns a provider here — catching the "silently falls through to
 * replicate" class of bug at build time rather than at runtime.
 */
export const VIDEO_MODEL_PROVIDERS: Record<VideoModelId, VideoProviderName> = {
  "sora-2": "openai",
  "sora-2-pro": "openai",
  "kling-v2-1-master": "kling",
  "luma-ray3": "luma",
  "google/veo-3": "gemini",
  "wan-video/wan-2.2-t2v-fast": "replicate",
  "wan-video/wan-2.2-i2v-fast": "replicate",
  "wan-video/wan-2.5-i2v": "replicate",
  "wan-video/wan-2.5-i2v-fast": "replicate",
  "genmo/mochi-1-final": "replicate",
  "minimax/video-02": "replicate",
};

export function resolveProviderForGenerationModel(
  modelId: VideoModelId,
): VideoProviderName {
  // Data-first lookup — preferred path. Type guards below stay for callers
  // that need the type-narrowing behavior (e.g., `isOpenAISoraModelId`).
  const mapped = VIDEO_MODEL_PROVIDERS[modelId];
  if (mapped) return mapped;

  if (isOpenAISoraModelId(modelId)) return "openai";
  if (isLumaModelId(modelId)) return "luma";
  if (isKlingModelId(modelId)) return "kling";
  if (isVeoModelId(modelId)) return "gemini";
  return "replicate";
}
