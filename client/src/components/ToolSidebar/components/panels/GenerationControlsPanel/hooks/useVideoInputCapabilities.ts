import { useMemo } from 'react';
import type { CapabilitiesSchema } from '@shared/capabilities';

export interface VideoInputCapabilities {
  supportsStartFrame: boolean;
  supportsEndFrame: boolean;
  supportsReferenceImages: boolean;
  supportsExtendVideo: boolean;
  maxReferenceImages: number;
}

const DEFAULT_VIDEO_INPUT_CAPABILITIES: VideoInputCapabilities = {
  supportsStartFrame: false,
  supportsEndFrame: false,
  supportsReferenceImages: false,
  supportsExtendVideo: false,
  maxReferenceImages: 0,
};

export function useVideoInputCapabilities(
  schema: CapabilitiesSchema | null
): VideoInputCapabilities {
  return useMemo(() => {
    if (!schema?.fields) {
      return DEFAULT_VIDEO_INPUT_CAPABILITIES;
    }

    const imageInput = schema.fields.image_input;
    const lastFrame = schema.fields.last_frame;
    const referenceImages = schema.fields.reference_images;
    const extendVideo = schema.fields.extend_video;

    const supportsReferenceImages = referenceImages?.default === true;

    return {
      supportsStartFrame: imageInput?.default === true,
      supportsEndFrame: lastFrame?.default === true,
      supportsReferenceImages,
      supportsExtendVideo: extendVideo?.default === true,
      maxReferenceImages: supportsReferenceImages ? 3 : 0,
    };
  }, [schema]);
}
