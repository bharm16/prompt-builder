/**
 * Motion API Client
 */

import { apiClient } from '@/services/ApiClient';
import { logger } from '@/services/LoggingService';
import type { CameraPath } from '@/features/convergence/types';
import { sanitizeError } from '@/utils/logging';
import { safeUrlHost } from '@/utils/url';

const log = logger.child('motionApi');
const OPERATION = 'estimateDepth';

export interface DepthEstimationResponse {
  depthMapUrl: string | null;
  cameraPaths: CameraPath[];
  fallbackMode: boolean;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export async function estimateDepth(imageUrl: string): Promise<DepthEstimationResponse> {
  const trimmedUrl = imageUrl.trim();
  if (!trimmedUrl) {
    const err = new Error('imageUrl is required');
    log.error('Depth estimation called without imageUrl', err, {
      operation: OPERATION,
    });
    throw err;
  }

  const depthRequestId = `depth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const imageUrlHost = safeUrlHost(trimmedUrl);

  log.info('Depth estimation request started', {
    operation: OPERATION,
    depthRequestId,
    imageUrlHost,
    imageUrlLength: trimmedUrl.length,
  });

  try {
    const result = (await apiClient.post('/motion/depth', {
      imageUrl: trimmedUrl,
    })) as ApiResponse<DepthEstimationResponse>;

    const durationMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
    );

    if (!result.success || !result.data) {
      log.warn('Depth estimation response indicated failure', {
        operation: OPERATION,
        depthRequestId,
        imageUrlHost,
        durationMs,
        success: result.success,
        error: result.error ?? 'Depth estimation failed',
        hasDetails: Boolean(result.details),
      });
      throw new Error(result.error || 'Depth estimation failed');
    }

    log.info('Depth estimation request succeeded', {
      operation: OPERATION,
      depthRequestId,
      imageUrlHost,
      durationMs,
      fallbackMode: result.data.fallbackMode,
      cameraPathsCount: result.data.cameraPaths.length,
      depthMapUrlHost: safeUrlHost(result.data.depthMapUrl),
    });

    return result.data;
  } catch (error) {
    const durationMs = Math.round(
      (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
    );
    const info = sanitizeError(error);
    const errObj = error instanceof Error ? error : new Error(info.message);

    log.error('Depth estimation request failed', errObj, {
      operation: OPERATION,
      depthRequestId,
      imageUrlHost,
      durationMs,
      errorName: info.name,
    });
    throw errObj;
  }
}
