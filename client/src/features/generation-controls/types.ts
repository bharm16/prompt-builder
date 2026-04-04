export type DraftModel = "flux-kontext" | "wan-2.2" | "wan-2.5";

export type VideoTier = "draft" | "render";

export interface KeyframeTile {
  id: string;
  url: string;
  source: "upload" | "library" | "generation" | "asset";
  assetId?: string;
  sourcePrompt?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface StartImage {
  url: string;
  source: string;
  assetId?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface SidebarUploadedImage {
  url: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface GenerationOverrides {
  startImage?: StartImage | null;
  endImage?: {
    url: string;
    storagePath?: string;
    viewUrlExpiresAt?: string;
  } | null;
  referenceImages?: Array<{
    url: string;
    type: "asset" | "style";
    storagePath?: string;
    viewUrlExpiresAt?: string;
  }>;
  extendVideoUrl?: string | null;
  generationParams?: Record<string, unknown>;
  characterAssetId?: string | null;
  faceSwapAlreadyApplied?: boolean;
  faceSwapUrl?: string | null;
}
