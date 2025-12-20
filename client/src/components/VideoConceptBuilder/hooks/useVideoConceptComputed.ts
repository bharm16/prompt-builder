/**
 * useVideoConceptComputed Hook
 *
 * Computes derived values from video concept state.
 * Extracts computed values logic from main component.
 */

import { useMemo } from 'react';
import { calculateGroupProgress, type GroupProgress } from '../utils/validation';
import { SUBJECT_DESCRIPTOR_KEYS } from '../config/constants';
import { detectDescriptorCategoryClient } from '@utils/subjectDescriptorCategories';
import type { ElementKey, Elements } from './types';
import type { CategoryDetection } from '../components/types';

export interface VideoConceptComputedValues {
  groupProgress: GroupProgress[];
  conceptPreviewText: string;
  filledCount: number;
  totalElementSlots: number;
  completionPercent: number;
  isReadyToGenerate: boolean;
  descriptorCategories: Record<string, CategoryDetection>;
}

export function useVideoConceptComputed(
  elements: Elements,
  composedElements: Record<string, string>
): VideoConceptComputedValues {
  const groupProgress = useMemo(
    () => calculateGroupProgress(elements),
    [elements]
  );

  const conceptPreviewText = useMemo(() => {
    const orderedKeys: ElementKey[] = [
      'subject',
      'action',
      'location',
      'time',
      'mood',
      'style',
      'event',
    ];
    const parts = orderedKeys
      .map((key) => composedElements[key])
      .filter(Boolean);
    return parts.join(' • ');
  }, [composedElements]);

  const filledCount = useMemo(
    () => Object.values(elements).filter((v) => v).length,
    [elements]
  );

  const totalElementSlots = useMemo(
    () => Object.keys(elements).length,
    [elements]
  );

  const completionPercent = useMemo(
    () => Math.round((filledCount / Math.max(totalElementSlots, 1)) * 100),
    [filledCount, totalElementSlots]
  );

  const isReadyToGenerate = useMemo(
    () => filledCount >= 3,
    [filledCount]
  );

  const descriptorCategories = useMemo(() => {
    const categories: Record<string, CategoryDetection> = {};
    SUBJECT_DESCRIPTOR_KEYS.forEach((key) => {
      const value = elements[key];
      if (value && value.trim()) {
        const detection = detectDescriptorCategoryClient(value);
        if (detection.confidence > 0.5 && detection.colors && detection.label) {
          categories[key] = {
            label: detection.label,
            confidence: detection.confidence,
            colors: detection.colors,
          };
        }
      }
    });
    return categories;
  }, [elements]);

  return {
    groupProgress,
    conceptPreviewText,
    filledCount,
    totalElementSlots,
    completionPercent,
    isReadyToGenerate,
    descriptorCategories,
  };
}
