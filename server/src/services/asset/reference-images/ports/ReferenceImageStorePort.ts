import type { Buffer } from "node:buffer";
import type {
  ReferenceImage,
  ReferenceImageMetadata,
} from "@shared/schemas/asset.schemas";

// Server-local alias preserved for callers that already use the
// `ReferenceImageRecord` name. Wire shape is owned by the shared schema.
export type ReferenceImageRecord = ReferenceImage;
export type { ReferenceImageMetadata };

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
