import type { VideoGenerationOptions, VideoGenerationResult } from '../types';

export const VIDEO_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type VideoJobStatus = typeof VIDEO_JOB_STATUSES[number];

export interface VideoJobRequest {
  prompt: string;
  options: VideoGenerationOptions;
}

export const VIDEO_JOB_ERROR_CATEGORIES = [
  'provider',
  'storage',
  'timeout',
  'infrastructure',
  'validation',
  'unknown',
] as const;
export type VideoJobErrorCategory = typeof VIDEO_JOB_ERROR_CATEGORIES[number];

export const VIDEO_JOB_ERROR_STAGES = [
  'generation',
  'persistence',
  'queue',
  'shutdown',
  'sweeper',
  'unknown',
] as const;
export type VideoJobErrorStage = typeof VIDEO_JOB_ERROR_STAGES[number];

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
  status: VideoJobStatus;
  userId: string;
  request: VideoJobRequest;
  creditsReserved: number;
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
}
