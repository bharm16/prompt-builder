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

export interface VideoGenerationOptions {
  model?: VideoModelKey | VideoModelId;
  aspectRatio?: '16:9' | '9:16' | '21:9' | '1:1';
  numFrames?: number;
  fps?: number;
  negativePrompt?: string;
  startImage?: string;
  inputReference?: string;
  seconds?: '4' | '8' | '12';
  size?: string;
}

export interface VideoGenerationResult {
  assetId: string;
  videoUrl: string;
  contentType: string;
}
