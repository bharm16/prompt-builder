import { VIDEO_MODELS } from '@config/modelConfig';
import type { VideoAssetStore } from './storage';

export interface ReplicateOptions {
  apiToken?: string;
  openAIKey?: string;
  lumaApiKey?: string;
  klingApiKey?: string;
  klingBaseUrl?: string;
  geminiApiKey?: string;
  geminiBaseUrl?: string;
}

export interface VideoGenerationServiceOptions extends ReplicateOptions {
  assetStore?: VideoAssetStore;
}

export type VideoModelKey = keyof typeof VIDEO_MODELS;
export type VideoModelId = (typeof VIDEO_MODELS)[VideoModelKey];

export type SoraModelId = 'sora-2' | 'sora-2-pro';
export type LumaModelId = 'luma-ray3';
export type KlingModelId = 'kling-v2-1-master';
export type VeoModelId = 'google/veo-3';
export type KlingAspectRatio = '16:9' | '9:16' | '1:1';

export interface VideoGenerationOptions {
  model?: VideoModelKey | VideoModelId;
  aspectRatio?: '16:9' | '9:16' | '21:9' | '1:1';
  numFrames?: number;
  fps?: number;
  negativePrompt?: string;
  /** Override Replicate's prompt_extend behavior for Wan models */
  promptExtend?: boolean;
  startImage?: string;
  /** End/last frame image URL for interpolation (Veo, Luma, Kling) */
  endImage?: string;
  /** Reference image URLs for style/character consistency (Veo: up to 3) */
  referenceImages?: Array<{ url: string; type: 'asset' | 'style' }>;
  /** URL of an existing video to extend/continue (Veo scene extension) */
  extendVideoUrl?: string;
  inputReference?: string;
  seconds?: '4' | '5' | '6' | '8' | '10' | '12';
  size?: string;
  seed?: number;
  /** Provider-native style reference image (if supported) */
  style_reference?: string;
  /** Optional weight/strength for provider-native style reference */
  style_reference_weight?: number;
  /** Asset ID of a character - triggers automatic PuLID keyframe generation */
  characterAssetId?: string;
  /** If true (default), automatically generate keyframe for character assets */
  autoKeyframe?: boolean;
  /** When true, startImage already includes a face-swap result (skip preprocessing). */
  faceSwapAlreadyApplied?: boolean;
  /** Optional face-swap preview URL for provenance/metadata. */
  faceSwapUrl?: string;
}

export interface VideoGenerationResult {
  assetId: string;
  videoUrl: string;
  contentType: string;
  inputMode?: 't2v' | 'i2v';
  startImageUrl?: string;
  storagePath?: string;
  viewUrl?: string;
  viewUrlExpiresAt?: string;
  sizeBytes?: number;
  seed?: number;
  /** The actual aspect ratio used by the provider (may differ from the requested one). */
  resolvedAspectRatio?: string;
  /** Provider-reported cost for this generation (if available). */
  providerCost?: { amount: number; currency: string; unit: string };
}

export interface VideoProviderAvailability {
  replicate: boolean;
  openai: boolean;
  luma: boolean;
  kling: boolean;
  gemini: boolean;
}

export interface VideoModelAvailability {
  id: string;
  available: boolean;
  reason?: 'unsupported_model' | 'missing_credentials' | 'unknown_availability';
  requiredKey?: string;
  resolvedModelId?: VideoModelId;
  capabilityModelId?: string;
  requestedId?: string;
  statusCode?: number;
  message?: string;
  supportsImageInput?: boolean;
  supportsI2V?: boolean;
  planTier?: string;
  entitled?: boolean;
}

export interface VideoAvailabilityReport {
  providers: VideoProviderAvailability;
  models: VideoModelAvailability[];
  availableModels: string[];
  availableCapabilityModels?: string[];
}

export interface VideoAvailabilitySnapshotModel {
  id: VideoModelId;
  available: boolean;
  reason?: VideoModelAvailability['reason'];
  requiredKey?: string;
  supportsI2V?: boolean;
  supportsImageInput?: boolean;
  planTier?: string;
  entitled?: boolean;
}

export interface VideoAvailabilitySnapshot {
  models: VideoAvailabilitySnapshotModel[];
  availableModelIds: VideoModelId[];
  unknownModelIds: VideoModelId[];
}
