import { z } from 'zod';
import { CAMERA_MOTION_CATEGORIES } from '@/features/convergence/types';
import {
  loadActiveTab,
  loadCameraMotion,
  loadConstraintMode,
  loadImageSubTab,
  loadKeyframes,
  loadSubjectMotion,
  persistActiveTab,
  persistCameraMotion,
  persistConstraintMode,
  persistImageSubTab,
  persistKeyframes,
  persistSubjectMotion,
} from './generationControlsStorage';
import {
  loadGenerationParams,
  loadSelectedModel,
  loadVideoTier,
  persistGenerationParams,
  persistSelectedModel,
  persistVideoTier,
} from './promptStateStorage';
import {
  DEFAULT_GENERATION_CONTROLS_STATE,
  type GenerationControlsState,
} from './generationControlsStoreTypes';

const STORAGE_KEY = 'prompt-optimizer:generationControlsStore';

const CapabilityValueSchema = z.union([z.string(), z.number(), z.boolean()]);
const CapabilityValuesSchema = z.record(z.string(), CapabilityValueSchema);

const ActiveTabSchema = z.enum(['video', 'image']);
const ImageSubTabSchema = z.enum(['references', 'styles']);
const ConstraintModeSchema = z.enum(['strict', 'flexible', 'transform']);
const VideoTierSchema = z.enum(['draft', 'render']);

const Position3DSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

const Rotation3DSchema = z.object({
  pitch: z.number(),
  yaw: z.number(),
  roll: z.number(),
});

const CameraTransformSchema = z.object({
  position: Position3DSchema,
  rotation: Rotation3DSchema,
});

const CameraPathSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    category: z.enum(CAMERA_MOTION_CATEGORIES),
    start: CameraTransformSchema,
    end: CameraTransformSchema,
    duration: z.number(),
  })
  .passthrough();

const KeyframeTileSchema = z.object({
  id: z.string(),
  url: z.string(),
  source: z.enum(['upload', 'library', 'generation', 'asset']),
  assetId: z.string().optional(),
  sourcePrompt: z.string().optional(),
  storagePath: z.string().optional(),
  viewUrlExpiresAt: z.string().optional(),
});

const KeyframesArraySchema = z.array(KeyframeTileSchema).max(3);

const GenerationControlsStoreSchema = z.object({
  domain: z.object({
    selectedModel: z.string(),
    generationParams: CapabilityValuesSchema,
    videoTier: VideoTierSchema,
    keyframes: KeyframesArraySchema,
    cameraMotion: CameraPathSchema.nullable(),
    subjectMotion: z.string(),
  }),
  ui: z.object({
    activeTab: ActiveTabSchema,
    imageSubTab: ImageSubTabSchema,
    constraintMode: ConstraintModeSchema,
  }),
});

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const buildLegacyState = (): GenerationControlsState => ({
  domain: {
    selectedModel: loadSelectedModel(),
    generationParams: loadGenerationParams(),
    videoTier: loadVideoTier(),
    keyframes: loadKeyframes(),
    cameraMotion: loadCameraMotion(),
    subjectMotion: loadSubjectMotion(),
  },
  ui: {
    activeTab: loadActiveTab(),
    imageSubTab: loadImageSubTab(),
    constraintMode: loadConstraintMode(),
  },
});

export const loadGenerationControlsStoreState = (): GenerationControlsState => {
  if (typeof window === 'undefined') {
    return DEFAULT_GENERATION_CONTROLS_STATE;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = GenerationControlsStoreSchema.safeParse(safeParseJson(raw));
      if (parsed.success) {
        return parsed.data as GenerationControlsState;
      }
    }
  } catch {
    // ignore
  }

  return buildLegacyState();
};

export const persistGenerationControlsStoreState = (
  state: GenerationControlsState
): void => {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }

  // Maintain legacy keys so existing contexts stay in sync.
  persistSelectedModel(state.domain.selectedModel);
  persistGenerationParams(state.domain.generationParams);
  persistVideoTier(state.domain.videoTier);
  persistKeyframes(state.domain.keyframes);
  persistCameraMotion(state.domain.cameraMotion);
  persistSubjectMotion(state.domain.subjectMotion);
  persistActiveTab(state.ui.activeTab);
  persistImageSubTab(state.ui.imageSubTab);
  persistConstraintMode(state.ui.constraintMode);
};
