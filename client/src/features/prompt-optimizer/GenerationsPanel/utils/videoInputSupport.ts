import { capabilitiesApi } from '@/services';
import { logger } from '@/services/LoggingService';

export interface VideoInputSupport {
  supportsEndFrame: boolean;
  supportsReferenceImages: boolean;
  supportsExtendVideo: boolean;
}

const log = logger.child('videoInputSupport');

const UNSUPPORTED_VIDEO_INPUTS: VideoInputSupport = {
  supportsEndFrame: false,
  supportsReferenceImages: false,
  supportsExtendVideo: false,
};

const supportCache = new Map<string, VideoInputSupport>();
const inflightSupport = new Map<string, Promise<VideoInputSupport>>();

const normalizeModelId = (modelId: string): string => modelId.trim();

const deriveSupportFromSchema = (
  schema: {
    fields?: Record<string, { default?: unknown }>;
  } | null
): VideoInputSupport => {
  const fields = schema?.fields;
  if (!fields) {
    return UNSUPPORTED_VIDEO_INPUTS;
  }

  return {
    supportsEndFrame: fields.last_frame?.default === true,
    supportsReferenceImages: fields.reference_images?.default === true,
    supportsExtendVideo: fields.extend_video?.default === true,
  };
};

export async function getVideoInputSupport(modelId: string): Promise<VideoInputSupport> {
  const normalizedModelId = normalizeModelId(modelId);
  if (!normalizedModelId) {
    return UNSUPPORTED_VIDEO_INPUTS;
  }

  const cached = supportCache.get(normalizedModelId);
  if (cached) {
    return cached;
  }

  const inflight = inflightSupport.get(normalizedModelId);
  if (inflight) {
    return await inflight;
  }

  const request = capabilitiesApi
    .getCapabilities('generic', normalizedModelId)
    .then((schema) => {
      const support = deriveSupportFromSchema(schema);
      supportCache.set(normalizedModelId, support);
      return support;
    })
    .catch((error: unknown) => {
      log.warn('Failed to resolve dispatch-model video input support; falling back to fail-closed', {
        modelId: normalizedModelId,
        error: error instanceof Error ? error.message : String(error),
      });
      supportCache.set(normalizedModelId, UNSUPPORTED_VIDEO_INPUTS);
      return UNSUPPORTED_VIDEO_INPUTS;
    })
    .finally(() => {
      inflightSupport.delete(normalizedModelId);
    });

  inflightSupport.set(normalizedModelId, request);
  return await request;
}

export function clearVideoInputSupportCache(): void {
  supportCache.clear();
  inflightSupport.clear();
}
