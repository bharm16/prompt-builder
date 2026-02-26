import { z } from 'zod';
import type { KeyframeTile } from '@components/ToolSidebar/types';
import type { CameraPath } from '@/features/convergence/types';
import { CAMERA_MOTION_CATEGORIES } from '@/features/convergence/types';

const STORAGE_KEYS = {
  cameraMotion: 'generation-controls:cameraMotion',
  subjectMotion: 'generation-controls:subjectMotion',
  activeTab: 'generation-controls:activeTab',
  imageSubTab: 'generation-controls:imageSubTab',
  constraintMode: 'generation-controls:constraintMode',
  keyframes: 'generation-controls:keyframes',
} as const;

const ActiveTabSchema = z.enum(['video', 'image']);
const ImageSubTabSchema = z.enum(['references', 'styles']);
const ConstraintModeSchema = z.enum(['strict', 'flexible', 'transform']);

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

const CameraPathSchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.enum(CAMERA_MOTION_CATEGORIES),
  start: CameraTransformSchema,
  end: CameraTransformSchema,
  duration: z.number(),
}).passthrough();

const SubjectMotionSchema = z.string();

const safeParseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const loadCameraMotion = (): CameraPath | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.cameraMotion);
    if (!raw) return null;
    const parsed = CameraPathSchema.safeParse(safeParseJson(raw));
    return parsed.success ? (parsed.data as CameraPath) : null;
  } catch {
    return null;
  }
};

export const loadSubjectMotion = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.subjectMotion);
    if (!value) return '';
    const parsed = SubjectMotionSchema.safeParse(value);
    return parsed.success ? parsed.data : '';
  } catch {
    return '';
  }
};

export const persistCameraMotion = (value: CameraPath | null): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEYS.cameraMotion);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.cameraMotion, JSON.stringify(value));
  } catch {
    // ignore
  }
};

export const persistSubjectMotion = (value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEYS.subjectMotion);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.subjectMotion, value);
  } catch {
    // ignore
  }
};

export const loadActiveTab = (): 'video' | 'image' => {
  if (typeof window === 'undefined') return 'video';
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.activeTab);
    if (!value) return 'video';
    const parsed = ActiveTabSchema.safeParse(value);
    return parsed.success ? parsed.data : 'video';
  } catch {
    return 'video';
  }
};

export const persistActiveTab = (value: 'video' | 'image'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.activeTab, value);
  } catch {
    // ignore
  }
};

export const loadImageSubTab = (): 'references' | 'styles' => {
  if (typeof window === 'undefined') return 'references';
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.imageSubTab);
    if (!value) return 'references';
    const parsed = ImageSubTabSchema.safeParse(value);
    return parsed.success ? parsed.data : 'references';
  } catch {
    return 'references';
  }
};

export const persistImageSubTab = (value: 'references' | 'styles'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.imageSubTab, value);
  } catch {
    // ignore
  }
};

export const loadConstraintMode = (): 'strict' | 'flexible' | 'transform' => {
  if (typeof window === 'undefined') return 'strict';
  try {
    const value = window.localStorage.getItem(STORAGE_KEYS.constraintMode);
    if (!value) return 'strict';
    const parsed = ConstraintModeSchema.safeParse(value);
    return parsed.success ? parsed.data : 'strict';
  } catch {
    return 'strict';
  }
};

export const persistConstraintMode = (value: 'strict' | 'flexible' | 'transform'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEYS.constraintMode, value);
  } catch {
    // ignore
  }
};

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

export const loadKeyframes = (): KeyframeTile[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.keyframes);
    if (!raw) return [];
    const parsed = KeyframesArraySchema.safeParse(safeParseJson(raw));
    return parsed.success ? (parsed.data as KeyframeTile[]) : [];
  } catch {
    return [];
  }
};

export const persistKeyframes = (value: KeyframeTile[]): void => {
  if (typeof window === 'undefined') return;
  try {
    if (!value.length) {
      window.localStorage.removeItem(STORAGE_KEYS.keyframes);
      return;
    }
    window.localStorage.setItem(STORAGE_KEYS.keyframes, JSON.stringify(value));
  } catch {
    // ignore
  }
};
