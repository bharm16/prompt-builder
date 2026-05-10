/**
 * Motion Idea Service Types
 *
 * Translates an `ImageObservation` into 3-5 short motion phrases the user
 * can pick from when adding motion to a still image (I2V).
 */

import type { ImageObservation } from "@services/image-observation/types";

export interface MotionIdeaRequest {
  /** Image URL, GCS signed URL, or base64 data URI. */
  image: string;
  /** Optional fast-path hint: prompt that produced this image. */
  sourcePrompt?: string;
  /** Optional pre-resolved observation; bypasses the observation step. */
  observation?: ImageObservation;
  /** Optional: bypass the observation cache. */
  skipCache?: boolean;
  /** Optional: set higher for the "New ideas" re-roll. */
  temperature?: number;
}

export interface MotionIdeaResponse {
  ideas: string[];
  observationCached: boolean;
  observationUsedFastPath: boolean;
  durationMs: number;
}

export const MOTION_IDEAS_FALLBACK: readonly string[] = Object.freeze([
  "subtle natural movement",
  "gentle ambient motion",
  "slow camera push",
]);
