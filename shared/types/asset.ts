export type AssetType = 'character' | 'style' | 'location' | 'object';

export interface AssetReferenceImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  isPrimary: boolean;
  storagePath?: string;
  thumbnailPath?: string;
  metadata: {
    angle?: 'front' | 'profile' | 'three-quarter' | 'back' | null;
    expression?: 'neutral' | 'smiling' | 'serious' | 'expressive' | null;
    styleType?: 'color-palette' | 'mood-board' | 'reference-frame' | null;
    timeOfDay?: 'day' | 'night' | 'golden-hour' | 'blue-hour' | null;
    lighting?: 'natural' | 'studio' | 'dramatic' | 'backlit' | null;
    uploadedAt: string;
    width: number;
    height: number;
    sizeBytes: number;
  };
}

export interface Asset {
  id: string;
  userId: string;
  type: AssetType;

  trigger: string;
  name: string;

  textDefinition: string;
  negativePrompt?: string;

  referenceImages: AssetReferenceImage[];

  faceEmbedding?: string | null;

  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssetRequest {
  type: AssetType;
  trigger: string;
  name: string;
  textDefinition: string;
  negativePrompt?: string;
}

export interface UpdateAssetRequest {
  trigger?: string;
  name?: string;
  textDefinition?: string;
  negativePrompt?: string;
}

export interface AssetListResponse {
  assets: Asset[];
  total: number;
  byType: {
    character: number;
    style: number;
    location: number;
    object: number;
  };
}

export interface ResolvedPrompt {
  originalText: string;
  expandedText: string;
  assets: Asset[];
  characters: Asset[];
  styles: Asset[];
  locations: Asset[];
  objects: Asset[];
  requiresKeyframe: boolean;
  negativePrompts: string[];
  referenceImages: Array<{
    assetId: string;
    assetType: AssetType;
    assetName?: string;
    imageUrl: string;
  }>;
}

export function isCharacterAsset(asset: Asset): boolean {
  return asset.type === 'character';
}

export function isStyleAsset(asset: Asset): boolean {
  return asset.type === 'style';
}

export function isLocationAsset(asset: Asset): boolean {
  return asset.type === 'location';
}
