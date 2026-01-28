export type GenerationMode = 'continuity' | 'standard';
export type ContinuityMode = 'frame-bridge' | 'style-match' | 'native' | 'none';

export interface StyleReference {
  id: string;
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

export interface ContinuityShot {
  id: string;
  sessionId: string;
  sequenceIndex: number;
  userPrompt: string;
  generationMode?: GenerationMode;
  continuityMode: ContinuityMode;
  styleStrength: number;
  styleReferenceId: string | null;
  characterAssetId?: string;
  modelId: string;
  videoAssetId?: string;
  generatedKeyframeUrl?: string;
  sceneProxyRenderUrl?: string;
  continuityMechanismUsed?: string;
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
  };
  shots: ContinuityShot[];
  defaultSettings: ContinuitySessionSettings;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
}
