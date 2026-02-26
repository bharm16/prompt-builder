/**
 * Storage configuration for GCS
 */

import { resolveBucketName } from '@config/storageBucket';
import { SIGNED_URL_TTL_MS } from '@config/signedUrlPolicy';

const bucketName = resolveBucketName();

export const STORAGE_CONFIG = {
  bucketName,
  paths: {
    previewImage: 'users/{userId}/previews/images/{timestamp}-{hash}.webp',
    previewVideo: 'users/{userId}/previews/videos/{timestamp}-{hash}.mp4',
    generation: 'users/{userId}/generations/{timestamp}-{hash}.mp4',
  },
  urlExpiration: {
    upload: SIGNED_URL_TTL_MS.upload,
    view: SIGNED_URL_TTL_MS.view,
    download: SIGNED_URL_TTL_MS.download,
  },
  retention: {
    previewImage: 7,
    previewVideo: 14,
    generation: 30,
  },
  retentionByPlan: {
    free: { previewImage: 7, previewVideo: 14, generation: 30 },
    explorer: { previewImage: 30, previewVideo: 30, generation: 90 },
    creator: { previewImage: 60, previewVideo: 60, generation: 180 },
    agency: { previewImage: 90, previewVideo: 90, generation: 365 },
  },
  maxFileSize: {
    previewImage: 10 * 1024 * 1024,
    previewVideo: 500 * 1024 * 1024,
    generation: 2 * 1024 * 1024 * 1024,
  },
  allowedContentTypes: {
    previewImage: ['image/webp', 'image/png', 'image/jpeg'],
    previewVideo: ['video/mp4', 'video/webm'],
    generation: ['video/mp4', 'video/webm', 'video/quicktime'],
  },
} as const;

export const STORAGE_TYPES = {
  PREVIEW_IMAGE: 'preview-image',
  PREVIEW_VIDEO: 'preview-video',
  GENERATION: 'generation',
} as const;

export type StorageType = (typeof STORAGE_TYPES)[keyof typeof STORAGE_TYPES];

export const STORAGE_TYPE_KEYS: Record<StorageType, keyof typeof STORAGE_CONFIG.allowedContentTypes> = {
  [STORAGE_TYPES.PREVIEW_IMAGE]: 'previewImage',
  [STORAGE_TYPES.PREVIEW_VIDEO]: 'previewVideo',
  [STORAGE_TYPES.GENERATION]: 'generation',
};

export function resolveStorageTypeKey(type: StorageType): keyof typeof STORAGE_CONFIG.allowedContentTypes {
  return STORAGE_TYPE_KEYS[type] || 'generation';
}

export default STORAGE_CONFIG;
