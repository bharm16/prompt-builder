import { AppError } from '@server/types/common';
import {
  isKlingModel,
  isLumaModel,
  isOpenAISoraModel,
  isVeoModel,
  resolveModelSelection,
} from '../modelResolver';
import { generateReplicateVideo } from '../providers/replicateProvider';
import { generateSoraVideo } from '../providers/soraProvider';
import { generateLumaVideo } from '../providers/lumaProvider';
import { generateKlingVideo } from '../providers/klingProvider';
import { generateVeoVideo } from '../providers/veoProvider';
import { storeVideoFromUrl } from '../storage/utils';
import type { StoredVideoAsset, VideoAssetStore } from '../storage';
import type { VideoGenerationOptions, VideoGenerationResult } from '../types';
import { getProviderAvailability } from '../providers/ProviderRegistry';
import { getModelAvailability } from '../availability';
import type { ProviderClients } from '../providers/ProviderClients';

type LogSink = {
  debug: (message: string, meta?: Record<string, unknown>) => void;
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, error?: Error) => void;
};

export async function generateVideoWorkflow(
  prompt: string,
  options: VideoGenerationOptions,
  clients: ProviderClients,
  assetStore: VideoAssetStore,
  log: LogSink
): Promise<VideoGenerationResult> {
  const modelSelection = typeof options.model === 'string' ? options.model.trim() : options.model;
  const startImageUrl = options.startImage || options.inputReference;
  const inputMode: VideoGenerationResult['inputMode'] = startImageUrl ? 'i2v' : 't2v';
  const availability = getModelAvailability(modelSelection, getProviderAvailability(clients), log);
  if (!availability.available) {
    throw new AppError(
      availability.message || 'Requested video model is not available',
      'VIDEO_MODEL_UNAVAILABLE',
      availability.statusCode || 424,
      {
        model: modelSelection || 'auto',
        reason: availability.reason,
        requiredKey: availability.requiredKey,
        resolvedModelId: availability.resolvedModelId,
      }
    );
  }

  const resolution = resolveModelSelection(modelSelection, log);
  const modelId = availability.resolvedModelId || resolution.modelId;

  log.info('Starting video generation', {
    modelSelection: modelSelection || 'auto',
    model: modelId,
    promptLength: prompt.length,
  });

  try {
    if (isOpenAISoraModel(modelId)) {
      if (!clients.openai) {
        throw new Error('Sora video generation requires OPENAI_API_KEY.');
      }
      const asset = await generateSoraVideo(
        clients.openai,
        prompt,
        modelId,
        options,
        assetStore,
        log
      );
      return formatResult(asset, inputMode, startImageUrl);
    }

    if (isLumaModel(modelId)) {
      if (!clients.luma) {
        throw new Error('Luma video generation requires LUMA_API_KEY or LUMAAI_API_KEY.');
      }
      const url = await generateLumaVideo(clients.luma, prompt, options, log);
      const asset = await storeVideoFromUrl(assetStore, url, log);
      return formatResult(asset, inputMode, startImageUrl);
    }

    if (isKlingModel(modelId)) {
      if (!clients.klingApiKey) {
        throw new Error('Kling video generation requires KLING_API_KEY.');
      }
      const url = await generateKlingVideo(
        clients.klingApiKey,
        clients.klingBaseUrl,
        prompt,
        modelId,
        options,
        log
      );
      const asset = await storeVideoFromUrl(assetStore, url, log);
      return formatResult(asset, inputMode, startImageUrl);
    }

    if (isVeoModel(modelId)) {
      if (!clients.geminiApiKey) {
        throw new Error('Veo video generation requires GEMINI_API_KEY.');
      }
      const asset = await generateVeoVideo(
        clients.geminiApiKey,
        clients.geminiBaseUrl,
        prompt,
        assetStore,
        log
      );
      return formatResult(asset, inputMode, startImageUrl);
    }

    if (!clients.replicate) {
      throw new Error('Replicate API token is required for the selected video model.');
    }

    const url = await generateReplicateVideo(clients.replicate, prompt, modelId, options, log);
    const asset = await storeVideoFromUrl(assetStore, url, log);
    return formatResult(asset, inputMode, startImageUrl);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error('Video generation failed', error instanceof Error ? error : new Error(errorMessage));
    throw error;
  }
}

function formatResult(
  asset: StoredVideoAsset,
  inputMode?: VideoGenerationResult['inputMode'],
  startImageUrl?: string
): VideoGenerationResult {
  return {
    assetId: asset.id,
    videoUrl: asset.url,
    contentType: asset.contentType,
    ...(inputMode ? { inputMode } : {}),
    ...(startImageUrl ? { startImageUrl } : {}),
  };
}
