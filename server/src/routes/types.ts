/**
 * Types for route factories
 */

import type { Router } from 'express';
import type { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import type { StoryboardPreviewService } from '@services/image-generation/storyboard/StoryboardPreviewService';
import type { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import type { AIModelService } from '@services/ai-model/AIModelService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import type { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import type { VideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import type KeyframeGenerationService from '@services/generation/KeyframeGenerationService';
import type { FaceSwapService } from '@services/generation/FaceSwapService';
import type { AssetService } from '@services/asset/AssetService';
import type { RequestIdempotencyService } from '@services/idempotency/RequestIdempotencyService';

export interface PreviewStorageService {
  saveFromUrl: (
    userId: string,
    sourceUrl: string,
    type: 'generation' | 'preview-image',
    metadata?: Record<string, unknown>
  ) => Promise<{
    storagePath: string;
    viewUrl: string;
    expiresAt: string;
    sizeBytes: number;
  }>;
  getViewUrl: (
    userId: string,
    path: string
  ) => Promise<{
    viewUrl: string;
    expiresAt: string;
    storagePath: string;
  }>;
  uploadBuffer: (
    userId: string,
    type: 'preview-image',
    buffer: Buffer,
    contentType: string,
    metadata?: Record<string, unknown>
  ) => Promise<{
    storagePath: string;
    viewUrl: string;
    expiresAt: string;
    sizeBytes: number;
    contentType: string;
  }>;
  uploadStream: (
    userId: string,
    type: 'preview-image',
    stream: NodeJS.ReadableStream,
    sizeBytes: number,
    contentType: string,
    metadata?: Record<string, unknown>
  ) => Promise<{
    storagePath: string;
    viewUrl: string;
    expiresAt: string;
    sizeBytes: number;
    contentType: string;
  }>;
}

/**
 * Services object for preview routes
 */
export interface PreviewRoutesServices {
  imageGenerationService: ImageGenerationService | null;
  storyboardPreviewService?: StoryboardPreviewService | null;
  videoGenerationService: VideoGenerationService | null;
  videoJobStore?: VideoJobStore | null;
  videoContentAccessService?: VideoContentAccessService | null;
  userCreditService?: UserCreditService | null;
  storageService?: PreviewStorageService | null;
  keyframeService?: KeyframeGenerationService | null;
  faceSwapService?: FaceSwapService | null;
  assetService?: AssetService | null;
  requestIdempotencyService?: RequestIdempotencyService | null;
}

/**
 * Route factory return type
 */
export type RouteFactory = () => Router;
