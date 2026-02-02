import type { Generation } from '@/features/prompt-optimizer/GenerationsPanel/types';
import type { HighlightSnapshot } from '../types';

export const resolveVersionTimestamp = (
  value: string | number | undefined
): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const asNumber = Number(value);
    if (!Number.isNaN(asNumber)) return asNumber;
  }
  return null;
};

export const mapShotStatusToGenerationStatus = (
  status: string
): Generation['status'] => {
  if (status === 'completed') return 'completed';
  if (status === 'failed') return 'failed';
  if (status === 'generating-keyframe' || status === 'generating-video') {
    return 'generating';
  }
  return 'pending';
};

export const isHighlightSnapshot = (value: unknown): value is HighlightSnapshot =>
  !!value &&
  typeof value === 'object' &&
  Array.isArray((value as HighlightSnapshot).spans);
