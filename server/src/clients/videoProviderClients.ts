import OpenAI from "openai";
import Replicate from "replicate";
import { LumaAI } from "lumaai";
import { DEFAULT_KLING_BASE_URL } from "@services/video-generation/providers/klingProvider";
import { DEFAULT_VEO_BASE_URL } from "@services/video-generation/providers/veoProvider";

/**
 * Pre-constructed SDK clients for the video-generation providers.
 *
 * Each field is null when the corresponding API key is not configured. The
 * KlingApiKey / geminiApiKey fields hold raw credentials because those
 * providers use raw HTTP rather than an SDK object.
 */
export interface VideoProviderSdks {
  replicate: Replicate | null;
  openai: OpenAI | null;
  luma: LumaAI | null;
  klingApiKey: string | null;
  klingBaseUrl: string;
  geminiApiKey: string | null;
  geminiBaseUrl: string;
}

/**
 * Configuration inputs to {@link createVideoProviderSdks}. All fields are
 * optional — the factory emits warnings and returns null clients when a key
 * is missing.
 */
export interface VideoProviderClientConfig {
  replicateApiToken?: string | undefined;
  openAIKey?: string | undefined;
  lumaApiKey?: string | undefined;
  klingApiKey?: string | undefined;
  klingBaseUrl?: string | undefined;
  geminiApiKey?: string | undefined;
  geminiBaseUrl?: string | undefined;
}

type WarnSink = {
  warn: (message: string, meta?: Record<string, unknown>) => void;
};

const TRAILING_SLASH_REGEX = /\/+$/;

function normalizeBaseUrl(
  candidate: string | undefined,
  fallback: string,
): string {
  return (candidate || fallback).replace(TRAILING_SLASH_REGEX, "");
}

/**
 * Construct the SDK clients used by the video-generation providers.
 *
 * This is the canonical place to instantiate `OpenAI`, `Replicate`, and
 * `LumaAI` for video generation. Passing the resulting {@link VideoProviderSdks}
 * object to `createVideoProviders` keeps business-logic files free of SDK
 * construction, matching the project rule that `clients/` owns external SDK
 * instantiation.
 *
 * @param config - API keys and base URLs.
 * @param log - Logger sink used to report missing credentials.
 */
export function createVideoProviderSdks(
  config: VideoProviderClientConfig,
  log: WarnSink,
): VideoProviderSdks {
  let replicate: Replicate | null = null;
  if (!config.replicateApiToken) {
    log.warn(
      "REPLICATE_API_TOKEN not provided, Replicate-based video generation will be disabled",
    );
  } else {
    replicate = new Replicate({ auth: config.replicateApiToken });
  }

  let openai: OpenAI | null = null;
  if (!config.openAIKey) {
    log.warn(
      "OPENAI_API_KEY not provided, Sora video generation will be disabled",
    );
  } else {
    openai = new OpenAI({ apiKey: config.openAIKey });
  }

  let luma: LumaAI | null = null;
  if (!config.lumaApiKey) {
    log.warn(
      "LUMA_API_KEY or LUMAAI_API_KEY not provided, Luma video generation will be disabled",
    );
  } else {
    luma = new LumaAI({ authToken: config.lumaApiKey });
  }

  let klingApiKey: string | null = null;
  if (!config.klingApiKey) {
    log.warn(
      "KLING_API_KEY not provided, Kling video generation will be disabled",
    );
  } else {
    klingApiKey = config.klingApiKey;
  }

  let geminiApiKey: string | null = null;
  if (!config.geminiApiKey) {
    log.warn(
      "GEMINI_API_KEY not provided, Veo video generation will be disabled",
    );
  } else {
    geminiApiKey = config.geminiApiKey;
  }

  return {
    replicate,
    openai,
    luma,
    klingApiKey,
    klingBaseUrl: normalizeBaseUrl(config.klingBaseUrl, DEFAULT_KLING_BASE_URL),
    geminiApiKey,
    geminiBaseUrl: normalizeBaseUrl(config.geminiBaseUrl, DEFAULT_VEO_BASE_URL),
  };
}
