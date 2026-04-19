import type { VideoGenerationOptions, VideoGenerationResult } from "../types";

export const VIDEO_JOB_STATUSES = [
  "queued",
  "processing",
  "completed",
  "failed",
] as const;
export type VideoJobStatus = (typeof VIDEO_JOB_STATUSES)[number];

export interface VideoJobRequest {
  prompt: string;
  options: VideoGenerationOptions;
}

export const VIDEO_JOB_ERROR_CATEGORIES = [
  "provider",
  "storage",
  "timeout",
  "infrastructure",
  "validation",
  "unknown",
] as const;
export type VideoJobErrorCategory = (typeof VIDEO_JOB_ERROR_CATEGORIES)[number];

export const VIDEO_JOB_ERROR_STAGES = [
  "generation",
  "persistence",
  "queue",
  "shutdown",
  "sweeper",
  "unknown",
] as const;
export type VideoJobErrorStage = (typeof VIDEO_JOB_ERROR_STAGES)[number];

export interface VideoJobError {
  message: string;
  code?: string;
  category?: VideoJobErrorCategory;
  retryable?: boolean;
  stage?: VideoJobErrorStage;
  provider?: string;
  attempt?: number;
}

export interface VideoJobRecord {
  id: string;
  /**
   * Forward-compatibility marker. Optional today (legacy records lack it),
   * but every NEW write sets `schemaVersion: 1`. Future migrations should
   * bump this literal so readers can gate behavior explicitly.
   */
  schemaVersion?: 1;
  status: VideoJobStatus;
  userId: string;
  /**
   * Optional session this job belongs to. Used by SessionService to cascade
   * cancellation on session delete, preventing orphan in-flight jobs.
   */
  sessionId?: string;
  requestId?: string;
  request: VideoJobRequest;
  creditsReserved: number;
  provider?: string;
  attempts: number;
  maxAttempts: number;
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs?: number;
  result?: VideoGenerationResult;
  error?: VideoJobError;
  workerId?: string;
  leaseExpiresAtMs?: number;
  lastHeartbeatAtMs?: number;
  releasedAtMs?: number;
  releaseReason?: string;
  /**
   * When set on a queued job, the worker will skip claiming it until `now >= nextRetryAtMs`.
   * Populated by `requeueForRetry` after a transient failure to implement backoff.
   */
  nextRetryAtMs?: number;
}

export const DLQ_STATUSES = [
  "pending",
  "processing",
  "reprocessed",
  "escalated",
] as const;
export type DlqStatus = (typeof DLQ_STATUSES)[number];

export interface DlqEntry {
  id: string;
  /**
   * Forward-compatibility marker. Optional today (legacy records lack it),
   * but every NEW write sets `schemaVersion: 1`. Future migrations should
   * bump this literal so readers can gate behavior explicitly.
   */
  schemaVersion?: 1;
  jobId: string;
  userId: string;
  request: VideoJobRequest;
  creditsReserved: number;
  /** Whether credits were refunded before this entry was created. When true, reprocessing must re-reserve credits. */
  creditsRefunded: boolean;
  provider: string;
  error: VideoJobError;
  source: string;
  dlqAttempt: number;
  maxDlqAttempts: number;
}
