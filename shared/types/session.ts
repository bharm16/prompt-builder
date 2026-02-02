export type SessionStatus = 'active' | 'completed' | 'archived';

export type SessionPromptKeyframeSource = 'upload' | 'library' | 'generation' | 'asset';

export interface SessionPromptKeyframe {
  id?: string;
  url: string;
  source?: SessionPromptKeyframeSource;
  assetId?: string;
  storagePath?: string;
  viewUrlExpiresAt?: string;
}

export interface SessionPromptVersionEdit {
  timestamp: string;
  delta?: number;
  source?: 'manual' | 'suggestion' | 'unknown';
}

export interface SessionPromptVersionPreview {
  generatedAt: string;
  imageUrl?: string | null;
  aspectRatio?: string | null;
}

export interface SessionPromptVersionVideo {
  generatedAt: string;
  videoUrl?: string | null;
  model?: string | null;
  generationParams?: Record<string, unknown> | null;
}

export interface SessionPromptVersionEntry {
  versionId: string;
  label?: string;
  signature: string;
  prompt: string;
  timestamp: string;
  highlights?: Record<string, unknown>;
  editCount?: number;
  edits?: SessionPromptVersionEdit[];
  preview?: SessionPromptVersionPreview;
  video?: SessionPromptVersionVideo;
  generations?: Array<Record<string, unknown>>;
}

export interface SessionPrompt {
  uuid?: string;
  title?: string | null;
  input: string;
  output: string;
  score?: number | null;
  mode?: string;
  targetModel?: string | null;
  generationParams?: Record<string, unknown> | null;
  keyframes?: SessionPromptKeyframe[] | null;
  brainstormContext?: Record<string, unknown> | null;
  highlightCache?: Record<string, unknown> | null;
  versions?: SessionPromptVersionEntry[];
}

export type SessionGenerationMode = 'continuity' | 'standard';
export type SessionContinuityMode = 'frame-bridge' | 'style-match' | 'native' | 'none';

export interface SessionStyleReference {
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
  extractedAt?: string;
}

export interface SessionFrameBridge {
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

export interface SessionSeedInfo {
  seed: number;
  provider: string;
  modelId: string;
  extractedAt: string;
}

export interface SessionContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;
  userPrompt: string;
  generationMode?: SessionGenerationMode;
  continuityMode: SessionContinuityMode;
  styleStrength: number;
  styleReferenceId: string | null;
  styleReference?: SessionStyleReference;
  frameBridge?: SessionFrameBridge;
  characterAssetId?: string;
  faceStrength?: number;
  camera?: {
    yaw?: number;
    pitch?: number;
    roll?: number;
    dolly?: number;
  };
  modelId: string;
  seedInfo?: SessionSeedInfo;
  inheritedSeed?: number;
  videoAssetId?: string;
  previewAssetId?: string;
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

export interface SessionContinuitySettings {
  generationMode: SessionGenerationMode;
  defaultContinuityMode: SessionContinuityMode;
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

export interface SessionSceneProxy {
  id: string;
  proxyType: string;
  referenceFrameUrl: string;
  depthMapUrl?: string;
  status: 'ready' | 'failed' | 'building';
  createdAt?: string;
  error?: string;
}

export interface SessionContinuity {
  shots: SessionContinuityShot[];
  primaryStyleReference?: SessionStyleReference | null;
  sceneProxy?: SessionSceneProxy | null;
  settings: SessionContinuitySettings;
}

export interface SessionDto {
  id: string;
  userId: string;
  name?: string;
  description?: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  prompt?: SessionPrompt;
  continuity?: SessionContinuity;
}
