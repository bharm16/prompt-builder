import type { VideoModelId } from '@services/video-generation/types';

export type GenerationMode = 'continuity' | 'standard';
export type ContinuityMode = 'frame-bridge' | 'style-match' | 'native' | 'none';
export type ContinuityMechanismUsed =
  | 'native-style-ref'
  | 'frame-bridge'
  | 'pulid-keyframe'
  | 'ip-adapter'
  | 'scene-proxy'
  | 'seed-only'
  | 'none';

/**
 * A frame extracted from a video for style reference or i2v input
 */
export interface StyleReference {
  id: string;
  sourceVideoId: string;
  sourceFrameIndex: number;

  frameUrl: string;
  frameTimestamp: number;

  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: string;

  clipEmbedding?: string;
  analysisMetadata?: StyleAnalysisMetadata;

  extractedAt: Date;
}

export interface StyleAnalysisMetadata {
  dominantColors: string[];
  lightingDescription: string;
  moodDescription: string;
  confidence: number;
}

export interface ProviderContinuityCapabilities {
  supportsNativeStyleReference: boolean;
  supportsNativeCharacterReference: boolean;
  supportsStartImage: boolean;
  supportsSeedPersistence: boolean;
  supportsExtendVideo: boolean;
  styleReferenceParam?: string;
  maxStyleReferenceImages?: number;
}

export interface SeedInfo {
  seed: number;
  provider: string;
  modelId: string;
  extractedAt: Date;
}

export interface FrameBridge {
  id: string;
  sourceVideoId: string;
  sourceShotId: string;

  frameUrl: string;
  framePosition: 'first' | 'last' | 'representative';
  frameTimestamp: number;

  resolution: {
    width: number;
    height: number;
  };
  aspectRatio: string;

  extractedAt: Date;
}

export interface SceneProxy {
  id: string;
  sourceVideoId: string;
  proxyType: 'depth-parallax' | 'gaussian-splat' | 'nerf';
  referenceFrameUrl: string;
  depthMapUrl?: string;
  createdAt: Date;
  status: 'ready' | 'failed' | 'building';
  error?: string;
}

export interface SceneProxyRender {
  id: string;
  proxyId: string;
  shotId: string;
  renderUrl: string;
  cameraPose?: {
    yaw: number;
    pitch: number;
    roll?: number;
    dolly?: number;
  };
  createdAt: Date;
}

export interface ContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;

  // User input
  userPrompt: string;
  generationMode?: GenerationMode;

  // Continuity settings
  continuityMode: ContinuityMode;
  styleStrength: number;

  // Style linkage — which shot provides the style reference
  styleReferenceId: string | null;
  styleReference?: StyleReference;

  // Frame bridge
  frameBridge?: FrameBridge;

  // Character reference
  characterAssetId?: string;
  faceStrength?: number;

  // Camera hints (optional)
  camera?: {
    yaw?: number;
    pitch?: number;
    roll?: number;
    dolly?: number;
  };

  // Generation details
  modelId: VideoModelId;

  // Seed persistence
  seedInfo?: SeedInfo;
  inheritedSeed?: number;

  // Outputs
  videoAssetId?: string;
  previewAssetId?: string;
  generatedKeyframeUrl?: string;
  styleTransferApplied?: boolean;
  styleDegraded?: boolean;
  styleDegradedReason?: string;
  sceneProxyRenderUrl?: string;

  // Which continuity mechanism was actually used
  continuityMechanismUsed?: ContinuityMechanismUsed;

  // Quality scores
  styleScore?: number;
  identityScore?: number;
  qualityScore?: number;
  retryCount?: number;

  // State
  status: 'draft' | 'generating-keyframe' | 'generating-video' | 'completed' | 'failed';
  error?: string;

  createdAt: Date;
  generatedAt?: Date;
}

export interface ContinuitySessionSettings {
  generationMode: GenerationMode;
  defaultContinuityMode: ContinuityMode;
  defaultStyleStrength: number;
  defaultModel: VideoModelId;
  autoExtractFrameBridge: boolean;
  useCharacterConsistency: boolean;
  useSceneProxy?: boolean;
  autoRetryOnFailure?: boolean;
  maxRetries?: number;
  qualityThresholds?: {
    style: number;
    identity: number;
  };
}

export interface ContinuitySession {
  id: string;
  userId: string;

  name: string;
  description?: string;

  primaryStyleReference: StyleReference;
  sceneProxy?: SceneProxy;

  shots: ContinuityShot[];

  defaultSettings: ContinuitySessionSettings;

  status: 'active' | 'completed' | 'archived';

  version?: number;

  createdAt: Date;
  updatedAt: Date;
}

export interface StyleMatchOptions {
  userId: string;
  prompt: string;
  styleReferenceUrl: string;
  strength: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  negativePrompt?: string;
}

export interface CharacterKeyframeOptions {
  userId: string;
  prompt: string;
  characterAssetId: string;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  faceStrength?: number;
}

export interface CreateShotRequest {
  sessionId: string;
  prompt: string;
  continuityMode?: ContinuityMode;
  generationMode?: GenerationMode;
  styleReferenceId?: string | null;
  styleStrength?: number;
  modelId?: VideoModelId;
  characterAssetId?: string;
  faceStrength?: number;
  camera?: {
    yaw?: number;
    pitch?: number;
    roll?: number;
    dolly?: number;
  };
}

export interface CreateSessionRequest {
  name: string;
  description?: string;
  sourceVideoId?: string;
  sourceImageUrl?: string;
  initialPrompt?: string;
  settings?: Partial<ContinuitySessionSettings>;
}

export interface ContinuityStrategy {
  type: ContinuityMechanismUsed;
  provider?: string;
}

export interface QualityGateResult {
  styleScore?: number;
  identityScore?: number;
  passed: boolean;
}
