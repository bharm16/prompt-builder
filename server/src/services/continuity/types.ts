import type {
  SessionContinuityMode,
  SessionContinuitySettings,
  SessionContinuityShot,
  SessionFrameBridge,
  SessionGenerationMode,
  SessionPromptVersionEntry,
  SessionSceneProxy,
  SessionSeedInfo,
  SessionStatus,
  SessionStyleReference,
} from '@shared/types/session';
import type { VideoModelId } from '@services/video-generation/types';

export type GenerationMode = SessionGenerationMode;
export type ContinuityMode = SessionContinuityMode;
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
export interface StyleReference
  extends Omit<
    SessionStyleReference,
    'sourceVideoId' | 'sourceFrameIndex' | 'extractedAt' | 'analysisMetadata'
  > {
  sourceVideoId: string;
  sourceFrameIndex: number;
  analysisMetadata?: StyleAnalysisMetadata;
  extractedAt: Date;
  clipEmbedding?: string;
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

export interface SeedInfo extends Omit<SessionSeedInfo, 'modelId' | 'extractedAt'> {
  modelId: VideoModelId;
  extractedAt: Date;
}

export interface FrameBridge extends Omit<SessionFrameBridge, 'extractedAt'> {
  extractedAt: Date;
}

export interface SceneProxy
  extends Omit<SessionSceneProxy, 'proxyType' | 'createdAt'> {
  sourceVideoId: string;
  proxyType: 'depth-parallax' | 'gaussian-splat' | 'nerf';
  createdAt: Date;
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

export interface ContinuityShot
  extends Omit<
    SessionContinuityShot,
    | 'generationMode'
    | 'continuityMode'
    | 'styleReference'
    | 'frameBridge'
    | 'seedInfo'
    | 'modelId'
    | 'createdAt'
    | 'generatedAt'
    | 'continuityMechanismUsed'
  > {
  generationMode?: GenerationMode;
  continuityMode: ContinuityMode;
  styleReference?: StyleReference;
  frameBridge?: FrameBridge;
  modelId: VideoModelId;
  seedInfo?: SeedInfo;
  continuityMechanismUsed?: ContinuityMechanismUsed;
  createdAt: Date;
  generatedAt?: Date;
  versions?: SessionPromptVersionEntry[];
}

export interface ContinuitySessionSettings
  extends Omit<
    SessionContinuitySettings,
    'generationMode' | 'defaultContinuityMode' | 'defaultModel'
  > {
  generationMode: GenerationMode;
  defaultContinuityMode: ContinuityMode;
  defaultModel: VideoModelId;
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

  status: SessionStatus;

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
  sourceVideoId?: string;
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
  sessionId?: string;
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
