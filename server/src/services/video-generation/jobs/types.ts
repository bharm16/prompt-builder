import type { VideoGenerationOptions, VideoGenerationResult } from '../types';

export const VIDEO_JOB_STATUSES = ['queued', 'processing', 'completed', 'failed'] as const;
export type VideoJobStatus = typeof VIDEO_JOB_STATUSES[number];

export interface VideoJobRequest {
  prompt: string;
  options: VideoGenerationOptions;
}

export interface VideoJobError {
  message: string;
}

export interface VideoJobRecord {
  id: string;
  status: VideoJobStatus;
  userId: string;
  request: VideoJobRequest;
  creditsReserved: number;
  createdAtMs: number;
  updatedAtMs: number;
  completedAtMs?: number;
  result?: VideoGenerationResult;
  error?: VideoJobError;
  workerId?: string;
  leaseExpiresAtMs?: number;
}

