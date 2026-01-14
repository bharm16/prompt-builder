/**
 * Image generation request types
 */

import type { ImagePreviewProviderSelection } from '../providers/types';

/**
 * Image generation options
 */
export interface ImageGenerationOptions {
  aspectRatio?: string;
  userId?: string;
  provider?: ImagePreviewProviderSelection;
}
