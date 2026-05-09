import type { Buffer } from "node:buffer";
import type {
  Asset,
  AssetReferenceImage,
  AssetType,
} from "@shared/types/asset";

export interface ReferenceImageMetadataInput {
  angle?: AssetReferenceImage["metadata"]["angle"];
  expression?: AssetReferenceImage["metadata"]["expression"];
  styleType?: AssetReferenceImage["metadata"]["styleType"];
  timeOfDay?: AssetReferenceImage["metadata"]["timeOfDay"];
  lighting?: AssetReferenceImage["metadata"]["lighting"];
  width?: number;
  height?: number;
}

export interface ProcessedImageInput {
  buffer: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  format?: string;
}

export interface GetByTypeResult {
  items: Asset[];
  hasMore: boolean;
}

export interface CreateAssetInput {
  type: AssetType;
  trigger: string;
  name: string;
  textDefinition: string;
  negativePrompt?: string;
}

export interface GetAllAssetsOptions {
  limit?: number;
  orderByField?: string;
  type?: AssetType | null;
}

export interface CreateUsageRecordInput {
  assetId: string;
  assetType: AssetType;
  generationId?: string | null;
  promptText?: string | null;
  expandedText?: string | null;
}

export interface BulkUsageRecord {
  assetId: string;
  assetType: AssetType;
  promptHash: string;
  promptLength: number;
  expandedHash: string;
  expandedLength: number;
}

/**
 * Port describing how the asset domain reads and writes asset data.
 *
 * The current shape mirrors the legacy `AssetRepository` and bundles three
 * related concerns (asset CRUD, reference-image-on-asset management, usage
 * tracking). Splitting into segregated ports — `AssetCrudPort`,
 * `AssetReferenceImagesPort`, `AssetUsagePort` — is a known follow-up.
 *
 * Implementations live under `services/asset/storage/`.
 */
export interface AssetStorePort {
  create(userId: string, assetData: CreateAssetInput): Promise<Asset>;

  getById(userId: string, assetId: string): Promise<Asset | null>;

  getByTrigger(userId: string, trigger: string): Promise<Asset | null>;

  getByTriggers(userId: string, triggers: string[]): Promise<Asset[]>;

  getByTriggerPrefix(
    userId: string,
    prefix: string,
    limit: number,
  ): Promise<Asset[]>;

  getAll(userId: string, options?: GetAllAssetsOptions): Promise<Asset[]>;

  getByType(
    userId: string,
    type: AssetType,
    limit?: number,
  ): Promise<GetByTypeResult>;

  update(
    userId: string,
    assetId: string,
    updates: Partial<Asset>,
  ): Promise<Asset | null>;

  incrementUsage(userId: string, assetId: string): Promise<void>;

  delete(userId: string, assetId: string): Promise<boolean>;

  addReferenceImage(
    userId: string,
    assetId: string,
    image: ProcessedImageInput,
    thumbnail: ProcessedImageInput,
    metadata: ReferenceImageMetadataInput,
  ): Promise<AssetReferenceImage>;

  deleteReferenceImage(
    userId: string,
    assetId: string,
    imageId: string,
  ): Promise<boolean>;

  setPrimaryImage(
    userId: string,
    assetId: string,
    imageId: string,
  ): Promise<Asset | null>;

  triggerExists(
    userId: string,
    trigger: string,
    excludeAssetId?: string | null,
  ): Promise<boolean>;

  createUsageRecord(
    userId: string,
    input: CreateUsageRecordInput,
  ): Promise<void>;

  recordBulkUsage(userId: string, records: BulkUsageRecord[]): Promise<void>;
}
