export type GenerationMode = 'continuity' | 'standard';
export type ContinuityMode = 'frame-bridge' | 'style-match' | 'native' | 'none';

export interface StyleReference {
  id: string;
  sourceVideoId?: string;
  sourceFrameIndex?: number;
  frameUrl: string;
  frameTimestamp: number;
  resolution: { width: number; height: number };
  aspectRatio: string;
  analysisMetadata?: {
    dominantColors: string[];
    lightingDescription: string;
    moodDescription: string;
    confidence: number;
  };
}

export interface FrameBridge {
  id: string;
  sourceVideoId: string;
  sourceShotId: string;
  frameUrl: string;
  framePosition: 'first' | 'last' | 'representative';
  frameTimestamp: number;
  resolution: { width: number; height: number };
  aspectRatio: string;
  extractedAt: string;
}

export interface SeedInfo {
  seed: number;
  provider: string;
  modelId: string;
  extractedAt: string;
}

export interface ContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;
  userPrompt: string;
  generationMode?: GenerationMode;
  continuityMode: ContinuityMode;
  styleStrength: number;
  styleReferenceId: string | null;
  styleReference?: StyleReference;
  frameBridge?: FrameBridge;
  characterAssetId?: string;
  faceStrength?: number;
  camera?: {
    yaw?: number;
    pitch?: number;
    roll?: number;
    dolly?: number;
  };
  modelId: string;
  seedInfo?: SeedInfo;
  inheritedSeed?: number;
  videoAssetId?: string;
  generatedKeyframeUrl?: string;
  styleTransferApplied?: boolean;
  styleDegraded?: boolean;
  styleDegradedReason?: string;
  sceneProxyRenderUrl?: string;
  continuityMechanismUsed?: string;
  styleScore?: number;
  identityScore?: number;
  qualityScore?: number;
  retryCount?: number;
  status: 'draft' | 'generating-keyframe' | 'generating-video' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  generatedAt?: string;
}

export interface ContinuitySessionSettings {
  generationMode: GenerationMode;
  defaultContinuityMode: ContinuityMode;
  defaultStyleStrength: number;
  defaultModel: string;
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
  sceneProxy?: {
    id: string;
    proxyType: string;
    referenceFrameUrl: string;
    depthMapUrl?: string;
    status: 'ready' | 'failed' | 'building';
    createdAt?: string;
    error?: string;
  };
  shots: ContinuityShot[];
  defaultSettings: ContinuitySessionSettings;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  name: string;
  description?: string;
  sourceVideoId?: string;
  sourceImageUrl?: string;
  initialPrompt?: string;
  settings?: Partial<ContinuitySessionSettings>;
}

export interface CreateShotInput {
  prompt: string;
  continuityMode?: ContinuityMode;
  generationMode?: GenerationMode;
  styleReferenceId?: string | null;
  styleStrength?: number;
  modelId?: string;
  characterAssetId?: string;
  faceStrength?: number;
  camera?: {
    yaw?: number;
    pitch?: number;
    roll?: number;
    dolly?: number;
  };
}
