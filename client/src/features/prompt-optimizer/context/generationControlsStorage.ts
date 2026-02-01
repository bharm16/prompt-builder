import { z } from 'zod';
import type { CameraPath } from '@/features/convergence/types';
import { CAMERA_MOTION_CATEGORIES } from '@/features/convergence/types';

const STORAGE_KEYS = {
  cameraMotion: 'generation-controls:cameraMotion',
  subjectMotion: 'generation-controls:subjectMotion',
} as const;

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
