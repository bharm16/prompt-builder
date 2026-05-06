import type { VideoProviderSdks } from "@clients/videoProviderClients";
import type {
  KlingModelId,
  SoraModelId,
  VideoGenerationOptions,
  VideoModelId,
} from "../types";
import type { StoredVideoAsset, VideoAssetStore } from "../storage";
import { storeVideoFromUrl } from "../storage/utils";
import { generateReplicateVideo } from "./replicateProvider";
import { generateSoraVideo } from "./soraProvider";
import { generateLumaVideo } from "./lumaProvider";
import { generateKlingVideo } from "./klingProvider";
import { generateVeoVideo } from "./veoProvider";

type LogSink = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (
    message: string,
    error?: Error,
    meta?: Record<string, unknown>,
  ) => void;
};

export type VideoProviderId =
  | "replicate"
  | "openai"
  | "luma"
  | "kling"
  | "gemini";

export interface VideoProvider {
  id: VideoProviderId;
  isAvailable: () => boolean;
  requiredKey?: string;
  generate: (
    prompt: string,
    modelId: VideoModelId,
    options: VideoGenerationOptions,
    assetStore: VideoAssetStore,
    log: LogSink,
  ) => Promise<{
    asset: StoredVideoAsset;
    seed?: number;
    resolvedAspectRatio?: string;
    providerCost?: { amount: number; currency: string; unit: string };
  }>;
}

export type VideoProviderMap = Record<VideoProviderId, VideoProvider>;

export function createVideoProviders(
  sdks: VideoProviderSdks,
): VideoProviderMap {
  const {
    replicate,
    openai,
    luma,
    klingApiKey,
    klingBaseUrl,
    geminiApiKey,
    geminiBaseUrl,
  } = sdks;

  const providers: VideoProviderMap = {
    replicate: {
      id: "replicate",
      requiredKey: "REPLICATE_API_TOKEN",
      isAvailable: () => Boolean(replicate),
      async generate(
        prompt,
        modelId,
        generationOptions,
        assetStore,
        providerLog,
      ) {
        if (!replicate) {
          throw new Error(
            "Replicate API token is required for the selected video model.",
          );
        }
        const { url, seed } = await generateReplicateVideo(
          replicate,
          prompt,
          modelId,
          generationOptions,
          providerLog,
        );
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return { asset, ...(seed !== undefined ? { seed } : {}) };
      },
    },
    openai: {
      id: "openai",
      requiredKey: "OPENAI_API_KEY",
      isAvailable: () => Boolean(openai),
      async generate(
        prompt,
        modelId,
        generationOptions,
        assetStore,
        providerLog,
      ) {
        if (!openai) {
          throw new Error("Sora video generation requires OPENAI_API_KEY.");
        }
        const { asset, resolvedAspectRatio } = await generateSoraVideo(
          openai,
          prompt,
          modelId as SoraModelId,
          generationOptions,
          assetStore,
          providerLog,
        );
        return {
          asset,
          ...(resolvedAspectRatio ? { resolvedAspectRatio } : {}),
        };
      },
    },
    luma: {
      id: "luma",
      requiredKey: "LUMA_API_KEY",
      isAvailable: () => Boolean(luma),
      async generate(
        prompt,
        _modelId,
        generationOptions,
        assetStore,
        providerLog,
      ) {
        if (!luma) {
          throw new Error(
            "Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.",
          );
        }
        const url = await generateLumaVideo(
          luma,
          prompt,
          generationOptions,
          providerLog,
        );
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return { asset };
      },
    },
    kling: {
      id: "kling",
      requiredKey: "KLING_API_KEY",
      isAvailable: () => Boolean(klingApiKey),
      async generate(
        prompt,
        modelId,
        generationOptions,
        assetStore,
        providerLog,
      ) {
        if (!klingApiKey) {
          throw new Error("Kling video generation requires KLING_API_KEY.");
        }
        const { url, resolvedAspectRatio } = await generateKlingVideo(
          klingApiKey,
          klingBaseUrl,
          prompt,
          modelId as KlingModelId,
          generationOptions,
          providerLog,
        );
        const asset = await storeVideoFromUrl(assetStore, url, providerLog);
        return {
          asset,
          ...(resolvedAspectRatio ? { resolvedAspectRatio } : {}),
        };
      },
    },
    gemini: {
      id: "gemini",
      requiredKey: "GEMINI_API_KEY",
      isAvailable: () => Boolean(geminiApiKey),
      async generate(
        prompt,
        _modelId,
        generationOptions,
        assetStore,
        providerLog,
      ) {
        if (!geminiApiKey) {
          throw new Error("Veo video generation requires GEMINI_API_KEY.");
        }
        const asset = await generateVeoVideo(
          geminiApiKey,
          geminiBaseUrl,
          prompt,
          generationOptions,
          assetStore,
          providerLog,
        );
        return { asset };
      },
    },
  };

  return providers;
}
