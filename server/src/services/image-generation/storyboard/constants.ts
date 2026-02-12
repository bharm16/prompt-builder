import type { ImagePreviewProviderId } from '@services/image-generation/providers/types';

export const STORYBOARD_FRAME_COUNT = 4;

export const BASE_PROVIDER: ImagePreviewProviderId = 'replicate-flux-schnell';
export const EDIT_PROVIDER: ImagePreviewProviderId = 'replicate-flux-kontext-fast';

/** Total duration of the storyboard sequence in seconds. */
export const STORYBOARD_DURATION_SECONDS = 4;

/** Timestamp for each frame position (including frame 0). Length must equal STORYBOARD_FRAME_COUNT. */
export const STORYBOARD_FRAME_TIMESTAMPS: readonly number[] = [0.0, 1.3, 2.7, 4.0];

/** Maximum number of Kontext edit frames to generate in parallel. */
export const STORYBOARD_MAX_PARALLEL = 3;
