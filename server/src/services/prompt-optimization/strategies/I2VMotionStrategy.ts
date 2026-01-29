/**
 * I2VMotionStrategy
 *
 * Optimizes prompts for image-to-video by:
 * 1. Extracting motion intent from user text
 * 2. Detecting conflicts with image observation
 * 3. Producing motion-focused output (optionally preserving visuals)
 */

import { logger } from '@infrastructure/Logger';
import type { AIService } from '../types';
import type { ImageObservation } from '@services/image-observation/types';
import {
  deriveLockMap,
  type I2VConstraintMode,
  type ConflictWarning,
  type I2VOptimizationResult,
} from '../types/i2v';

interface I2VOptimizeParams {
  prompt: string;
  observation: ImageObservation;
  mode?: I2VConstraintMode;
  cameraMotionLocked?: boolean;
}

export class I2VMotionStrategy {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'I2VMotionStrategy' });

  constructor(aiService: AIService) {
    this.ai = aiService;
  }

  async optimize(params: I2VOptimizeParams): Promise<I2VOptimizationResult> {
    const { prompt, observation, mode = 'strict', cameraMotionLocked = false } = params;
    const lockMap = deriveLockMap(mode, { cameraMotionLocked });

    this.log.debug('Starting i2v optimization', {
      mode,
      promptLength: prompt.length,
      cameraMotionLocked,
      observationConfidence: observation.confidence,
    });

    const parsed = await this.parsePrompt(prompt);
    const conflicts = this.detectConflicts(parsed.visual, parsed.motion, observation, mode, cameraMotionLocked);
    const outputPrompt = this.buildMotionPrompt(parsed, observation, mode, cameraMotionLocked);

    return {
      prompt: outputPrompt,
      conflicts,
      appliedMode: mode,
      lockMap,
      extractedMotion: {
        subjectAction: parsed.motion.subjectAction,
        cameraMovement: parsed.motion.cameraMovement,
        pacing: parsed.motion.pacing,
      },
    };
  }

  private async parsePrompt(prompt: string): Promise<ParsedPrompt> {
    const normalizeNullableString = (value: unknown): string | null => {
      if (value === null || typeof value === 'undefined') return null;
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!trimmed) return null;
      const lowered = trimmed.toLowerCase();
      if (['null', 'none', 'n/a', 'na', 'unknown'].includes(lowered)) return null;
      return trimmed;
    };

    const systemPrompt = `You separate video prompts into motion vs visual components.

Motion = actions, movements, camera moves, pacing, emotional changes
Visual = subject descriptions, lighting, environment, colors, shot types

Return JSON:
{
  "motion": {
    "subjectAction": "what the subject does (or null)",
    "cameraMovement": "camera movement (or null)",
    "pacing": "slow|medium|fast|null",
    "emotional": "emotional change (or null)"
  },
  "visual": {
    "subjectDescription": "visual description of subject (or null)",
    "lighting": "lighting description (or null)",
    "environment": "environment description (or null)",
    "shotType": "shot type mentioned (or null)",
    "timeOfDay": "time of day mentioned (or null)"
  }
}`;

    try {
      const response = await this.ai.execute('parse_i2v_prompt', {
        systemPrompt,
        userMessage: prompt,
        maxTokens: 400,
        temperature: 0.1,
        jsonMode: true,
      });

      const parsed = JSON.parse(
        response.text.replace(/```json\s*/g, '').replace(/```/g, '').trim()
      );

      return {
        motion: {
          subjectAction: normalizeNullableString(parsed.motion?.subjectAction),
          cameraMovement: normalizeNullableString(parsed.motion?.cameraMovement),
          pacing: normalizeNullableString(parsed.motion?.pacing),
          emotional: normalizeNullableString(parsed.motion?.emotional),
        },
        visual: {
          subjectDescription: normalizeNullableString(parsed.visual?.subjectDescription),
          lighting: normalizeNullableString(parsed.visual?.lighting),
          environment: normalizeNullableString(parsed.visual?.environment),
          shotType: normalizeNullableString(parsed.visual?.shotType),
          timeOfDay: normalizeNullableString(parsed.visual?.timeOfDay),
        },
        raw: prompt,
        parseFailed: false,
      };
    } catch (error) {
      this.log.warn('Prompt parse failed, using heuristic fallback', {
        error: (error as Error).message,
      });
      return {
        motion: {
          subjectAction: prompt,
          cameraMovement: this.detectCameraMovement(prompt),
          pacing: this.detectPacing(prompt),
          emotional: null,
        },
        visual: {},
        raw: prompt,
        parseFailed: true,
      };
    }
  }

  private detectConflicts(
    visual: ParsedPrompt['visual'],
    motion: ParsedPrompt['motion'],
    observation: ImageObservation,
    mode: I2VConstraintMode,
    cameraMotionLocked: boolean
  ): ConflictWarning[] {
    const conflicts: ConflictWarning[] = [];

    if (cameraMotionLocked && motion.cameraMovement) {
      conflicts.push({
        category: 'camera.movement',
        userSaid: motion.cameraMovement,
        imageShows: 'camera movement locked by UI',
        severity: 'blocked',
      });
    }

    if (mode === 'transform') {
      return conflicts;
    }

    if (observation.confidence < 0.4) {
      return conflicts;
    }

    if (visual.timeOfDay && observation.lighting.timeOfDay !== 'unknown') {
      const userTime = visual.timeOfDay.toLowerCase();
      const imageTime = observation.lighting.timeOfDay;
      const isConflict =
        (userTime.includes('night') && imageTime !== 'night') ||
        (userTime.includes('day') && imageTime === 'night') ||
        (userTime.includes('golden') && imageTime !== 'golden-hour') ||
        (userTime.includes('indoor') && imageTime !== 'indoor');

      if (isConflict) {
        conflicts.push({
          category: 'lighting',
          userSaid: visual.timeOfDay,
          imageShows: imageTime,
          severity: mode === 'strict' ? 'blocked' : 'warning',
        });
      }
    }

    if (visual.shotType) {
      const userShot = visual.shotType.toLowerCase();
      const imageShot = observation.framing.shotType;
      const isConflict =
        (userShot.includes('wide') && imageShot.includes('close')) ||
        (userShot.includes('close') && imageShot.includes('wide')) ||
        (userShot.includes('extreme') && !imageShot.includes('extreme'));

      if (isConflict) {
        conflicts.push({
          category: 'shot.type',
          userSaid: visual.shotType,
          imageShows: imageShot,
          severity: mode === 'strict' ? 'blocked' : 'warning',
        });
      }
    }

    if (visual.subjectDescription && observation.subject.description) {
      const userSubject = visual.subjectDescription.toLowerCase();
      const imageSubject = observation.subject.description.toLowerCase();

      const genderConflict =
        (userSubject.includes('woman') && imageSubject.includes('man')) ||
        (userSubject.includes('man') && imageSubject.includes('woman'));

      const ageConflict =
        (userSubject.includes('young') && imageSubject.includes('elder')) ||
        (userSubject.includes('child') && imageSubject.includes('adult'));

      if (genderConflict || ageConflict) {
        conflicts.push({
          category: 'subject.identity',
          userSaid: visual.subjectDescription,
          imageShows: observation.subject.description,
          severity: 'blocked',
        });
      }
    }

    if (motion.cameraMovement) {
      const requested = motion.cameraMovement.toLowerCase();
      const isRisky = observation.motion.risky.some((movement) =>
        requested.includes(movement.replace('-', ' '))
      );
      if (isRisky) {
        conflicts.push({
          category: 'camera.movement',
          userSaid: motion.cameraMovement,
          imageShows: 'risky with current framing',
          severity: mode === 'strict' ? 'blocked' : 'warning',
        });
      }
    }

    return conflicts;
  }

  private buildMotionPrompt(
    parsed: ParsedPrompt,
    observation: ImageObservation,
    mode: I2VConstraintMode,
    cameraMotionLocked: boolean
  ): string {
    const parts: string[] = [];
    const motion = parsed.motion;

    const subjectAction = motion.subjectAction
      ? (mode === 'strict' && parsed.parseFailed
          ? this.stripVisualHints(motion.subjectAction)
          : motion.subjectAction)
      : null;

    if (subjectAction) {
      parts.push(subjectAction);
    }

    if (motion.cameraMovement) {
      const requested = motion.cameraMovement.toLowerCase();
      const isRisky = observation.motion.risky.some((movement) =>
        requested.includes(movement.replace('-', ' '))
      );

      if (!cameraMotionLocked && (!isRisky || mode !== 'strict')) {
        parts.push(motion.cameraMovement);
      }
    }

    if (motion.pacing) {
      const pacingMap: Record<string, string> = {
        slow: 'smooth gentle movement',
        medium: 'natural pacing',
        fast: 'dynamic energetic motion',
      };
      parts.push(pacingMap[motion.pacing] || motion.pacing);
    }

    if (motion.emotional) {
      parts.push(motion.emotional);
    }

    if (mode !== 'strict') {
      const visuals = [
        parsed.visual.subjectDescription,
        parsed.visual.environment,
        parsed.visual.lighting,
        parsed.visual.shotType,
        parsed.visual.timeOfDay,
      ].filter(Boolean);
      if (visuals.length > 0) {
        parts.push(visuals.join(', '));
      }
    }

    if (parts.filter(Boolean).length === 0) {
      parts.push('subtle natural movement');
    }

    return parts.filter(Boolean).join(', ');
  }

  private detectCameraMovement(text: string): string | null {
    const lower = text.toLowerCase();
    if (/pan left|pan right|pan/.test(lower)) return 'pan';
    if (/tilt up|tilt down|tilt/.test(lower)) return 'tilt';
    if (/dolly in|push in/.test(lower)) return 'dolly in';
    if (/dolly out|pull back/.test(lower)) return 'dolly out';
    if (/zoom in|zoom out|zoom/.test(lower)) return 'zoom';
    if (/crane up|crane down|crane/.test(lower)) return 'crane';
    return null;
  }

  private detectPacing(text: string): 'slow' | 'medium' | 'fast' | null {
    const lower = text.toLowerCase();
    if (/\bslow|slowly|gentle\b/.test(lower)) return 'slow';
    if (/\bfast|quick|rapid\b/.test(lower)) return 'fast';
    if (/\bsteady|natural|moderate\b/.test(lower)) return 'medium';
    return null;
  }

  private stripVisualHints(text: string): string {
    return text
      .replace(/\b(golden hour|sunset|sunrise|blue hour|night|daylight|indoor|outdoor)\b/gi, '')
      .replace(/\b(close-up|wide shot|medium shot|establishing shot)\b/gi, '')
      .replace(/\b(soft light|hard light|fluorescent|neon|dramatic lighting)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }
}

interface ParsedPrompt {
  motion: {
    subjectAction: string | null;
    cameraMovement: string | null;
    pacing: 'slow' | 'medium' | 'fast' | string | null;
    emotional: string | null;
  };
  visual: {
    subjectDescription?: string | null;
    lighting?: string | null;
    environment?: string | null;
    shotType?: string | null;
    timeOfDay?: string | null;
  };
  raw: string;
  parseFailed: boolean;
}
