export interface VideoAssetStream {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength?: number;
}

export interface StoredVideoAsset {
  id: string;
  url: string;
  contentType: string;
  createdAt: number;
  sizeBytes?: number;
}

export interface VideoAssetStore {
  storeFromBuffer(buffer: Buffer, contentType: string): Promise<StoredVideoAsset>;
  storeFromStream(stream: NodeJS.ReadableStream, contentType: string): Promise<StoredVideoAsset>;
  getStream(assetId: string): Promise<VideoAssetStream | null>;
  getPublicUrl(assetId: string): Promise<string | null>;
  cleanupExpired(olderThanMs: number, maxItems?: number): Promise<number>;
}
