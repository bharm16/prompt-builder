/**
 * I2VConstrainedSuggestions
 *
 * Filters enhancement suggestions based on image observation.
 */

import type { ImageObservation } from '@services/image-observation/types';
import type { LockMap, LockableCategory } from '@services/prompt-optimization/types/i2v';
import type { Suggestion } from './types';

interface FilteredSuggestionResult {
  suggestions: Suggestion[];
  blockedReason?: string;
  motionAlternatives?: Suggestion[];
}

const CATEGORY_MAPPING: Record<string, LockableCategory | null> = {
  'subject.identity': 'subject.identity',
  'subject.age': 'subject.identity',
  'subject.gender': 'subject.identity',
  'subject.appearance': 'subject.appearance',
  'subject.clothing': 'subject.appearance',
  'shot.type': 'shot.type',
  'shot.framing': 'shot.type',
  'shot.angle': 'shot.angle',
  'lighting.type': 'lighting',
  'lighting.quality': 'lighting',
  'lighting.direction': 'lighting',
  'environment.setting': 'environment',
  'environment.location': 'environment',
  'color.palette': 'color',
  'style.visual': 'color',
  // Motion categories - not locked
  'action.movement': null,
  'action.gesture': null,
  'camera.movement': 'camera.movement',
  'camera.speed': null,
  'timing.pacing': null,
  'subject.expression': null,
  'subject.emotion': null,
};

export class I2VConstrainedSuggestions {
  filterSuggestions(
    suggestions: Suggestion[],
    category: string,
    lockMap: LockMap,
    observation: ImageObservation
  ): FilteredSuggestionResult {
    const lockableCategory = CATEGORY_MAPPING[category];

    if (lockableCategory == null) {
      return { suggestions };
    }

    const lockStatus = lockMap[lockableCategory];

    if (lockStatus === 'hard') {
      const includeCameraMovements = lockableCategory !== 'camera.movement';
      return {
        suggestions: [],
        blockedReason: this.getBlockedReason(lockableCategory, observation),
        motionAlternatives: this.getMotionAlternatives(observation, {
          includeCameraMovements,
        }),
      };
    }

    const filteredSuggestions =
      lockableCategory === 'camera.movement'
        ? this.filterCameraMovementSuggestions(suggestions, observation)
        : suggestions;

    if (lockStatus === 'soft') {
      return {
        suggestions: filteredSuggestions.map((suggestion) => ({
          ...suggestion,
          ...(typeof suggestion.confidence === 'number'
            ? { confidence: suggestion.confidence * 0.5 }
            : {}),
        })),
      };
    }

    return { suggestions: filteredSuggestions };
  }

  isMotionCategory(category: string): boolean {
    return CATEGORY_MAPPING[category] === null;
  }

  private getBlockedReason(category: LockableCategory, observation: ImageObservation): string {
    const reasons: Record<LockableCategory, string> = {
      'subject.identity': `Subject is fixed: ${observation.subject.description}`,
      'subject.appearance': 'Subject appearance is defined by the image',
      'shot.type': `Shot type is ${observation.framing.shotType} (fixed by image)`,
      'shot.angle': `Camera angle is ${observation.framing.angle} (fixed by image)`,
      'lighting': `Lighting is ${observation.lighting.quality} ${observation.lighting.timeOfDay} (fixed by image)`,
      'environment': 'Environment is defined by the image',
      'color': 'Color palette is defined by the image',
      'camera.movement': 'Camera movement is locked by UI controls',
    };

    return reasons[category];
  }

  private getMotionAlternatives(
    observation: ImageObservation,
    options?: { includeCameraMovements?: boolean }
  ): Suggestion[] {
    const alternatives: Suggestion[] = [];
    const includeCameraMovements = options?.includeCameraMovements !== false;

    if (includeCameraMovements) {
      for (const movement of observation.motion.recommended.slice(0, 3)) {
        alternatives.push({
          text: `camera ${movement.replace('-', ' ')}`,
          category: 'camera.movement',
          confidence: 0.9,
        });
      }
    }

    alternatives.push(
      { text: 'subtle natural movement', category: 'action.movement', confidence: 0.85 },
      { text: 'gentle motion', category: 'action.movement', confidence: 0.8 }
    );

    return alternatives;
  }

  private filterCameraMovementSuggestions(
    suggestions: Suggestion[],
    observation: ImageObservation
  ): Suggestion[] {
    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      return suggestions;
    }

    const riskyMoves = observation.motion.risky ?? [];
    if (riskyMoves.length === 0) {
      return suggestions;
    }

    const riskyVariants = new Set(
      riskyMoves.flatMap((movement) => {
        const normalized = movement.toLowerCase();
        return [normalized, normalized.replace(/-/g, ' ')];
      })
    );

    return suggestions.filter((suggestion) => {
      const text = (suggestion.text ?? '').toLowerCase();
      if (!text) {
        return true;
      }
      for (const variant of riskyVariants) {
        if (variant && text.includes(variant)) {
          return false;
        }
      }
      return true;
    });
  }
}
