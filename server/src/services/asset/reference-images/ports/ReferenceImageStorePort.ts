import type { Buffer } from "node:buffer";

export interface ReferenceImageMetadata {
  width: number;
  height: number;
  sizeBytes: number;
  contentType: string;
  source?: string | null;
  originalName?: string | null;
}

export interface ReferenceImageRecord {
  id: string;
  userId: string;
  imageUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailPath: string;
  label?: string | null;
  metadata: ReferenceImageMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReferenceImageInput {
  label?: string | null;
  source?: string | null;
  originalName?: string | null;
}

export interface ListReferenceImagesOptions {
  limit?: number;
}

/**
 * Port consumed by routes and services that need reference-image persistence.
 *
 * Implementations live under `services/asset/reference-images/storage/`.
 * Service-tier code depends on this port and never imports the Firestore /
 * GCS SDKs directly.
 */
export interface ReferenceImageStorePort {
  listImages(
    userId: string,
    options?: ListReferenceImagesOptions,
  ): Promise<ReferenceImageRecord[]>;

  createFromBuffer(
    userId: string,
    buffer: Buffer,
    input?: CreateReferenceImageInput,
  ): Promise<ReferenceImageRecord>;

  createFromUrl(
    userId: string,
    sourceUrl: string,
    input?: CreateReferenceImageInput,
  ): Promise<ReferenceImageRecord>;

  deleteImage(userId: string, imageId: string): Promise<boolean>;
}
