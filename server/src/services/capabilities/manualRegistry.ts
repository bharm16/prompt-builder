import type { CapabilitiesSchema } from '@shared/capabilities';
import {
  aspectRatioField,
  audioField,
  buildSchema,
  durationField,
  fpsField,
  guidanceField,
  imageInputField,
  resolutionField,
  seedField,
} from './templates';

export const MANUAL_CAPABILITIES_REGISTRY: Record<
  string,
  Record<string, CapabilitiesSchema>
> = {
  generic: {
    auto: buildSchema('generic', 'auto', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24]),
    }),
  },
  openai: {
    'sora-2': buildSchema('openai', 'sora-2', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      audio: audioField(false),
      seed: seedField(),
      guidance: guidanceField(7),
      image_input: imageInputField(true),
    }),
    'sora-2-pro': buildSchema('openai', 'sora-2-pro', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      audio: audioField(false),
      seed: seedField(),
      guidance: guidanceField(7),
      image_input: imageInputField(true),
    }),
  },
  runway: {
    'runway-gen45': buildSchema('runway', 'runway-gen45', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      seed: seedField(),
      guidance: guidanceField(6),
    }),
  },
  luma: {
    'luma-ray3': buildSchema('luma', 'luma-ray3', {
      aspect_ratio: aspectRatioField(['16:9', '9:16']),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24]),
      seed: seedField(),
      image_input: imageInputField(true),
    }),
  },
  google: {
    'veo-4': buildSchema('google', 'veo-4', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8]),
      resolution: resolutionField(),
      fps: fpsField([24, 30]),
      audio: audioField(false),
      seed: seedField(),
      guidance: guidanceField(8),
      image_input: imageInputField(false),
    }),
  },
  kling: {
    'kling-26': buildSchema('kling', 'kling-26', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([5, 10, 15]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24, 30]),
      audio: audioField(true),
      seed: seedField(),
      image_input: imageInputField(true),
    }),
  },
  wan: {
    'wan-2.2': buildSchema('wan', 'wan-2.2', {
      aspect_ratio: aspectRatioField(),
      duration_s: durationField([4, 8, 12]),
      resolution: resolutionField(['720p']),
      fps: fpsField([24, 30]),
      seed: seedField(),
      image_input: imageInputField(true),
    }),
  },
};
