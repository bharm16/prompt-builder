import type {
  SessionContinuity,
  SessionContinuityMode,
  SessionContinuitySettings,
  SessionContinuityShot,
  SessionGenerationMode,
  SessionFrameBridge,
  SessionSeedInfo,
  SessionSceneProxy,
  SessionStyleReference,
} from '@shared/types/session';

export type GenerationMode = SessionGenerationMode;
export type ContinuityMode = SessionContinuityMode;
export type StyleReference = SessionStyleReference;
export type FrameBridge = SessionFrameBridge;
export type SeedInfo = SessionSeedInfo;
export type ContinuityShot = SessionContinuityShot;
export type ContinuitySessionSettings = SessionContinuitySettings;
export type ContinuitySession = {
  id: string;
  userId: string;
  name: string;
  description?: string;
  primaryStyleReference: StyleReference;
  sceneProxy?: SessionSceneProxy;
  shots: ContinuityShot[];
  defaultSettings: ContinuitySessionSettings;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  updatedAt: string;
};

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

export type ContinuitySessionPayload = SessionContinuity;
