/**
 * Preview Routes
 *
 * Handles image preview generation endpoints
 */

import type { Router } from 'express';
import express from 'express';
import { createDiskUpload } from '@utils/upload';
import { asyncHandler } from '@middleware/asyncHandler';
import { userCreditService as defaultUserCreditService } from '@services/credits/UserCreditService';
import type { PreviewRoutesServices } from './types';
import { createImageGenerateHandler } from './preview/handlers/imageGenerate';
import { createImageStoryboardGenerateHandler } from './preview/handlers/imageStoryboardGenerate';
import { createVideoAvailabilityHandler } from './preview/handlers/videoAvailability';
import { createVideoGenerateHandler } from './preview/handlers/videoGenerate';
import { createVideoJobsHandler } from './preview/handlers/videoJobs';
import { createVideoContentHandler } from './preview/handlers/videoContent';
import { createPublicVideoContentHandler } from './preview/handlers/publicVideoContent';
import { createImageContentHandler } from './preview/handlers/imageContent';
import { createImageUploadHandler } from './preview/handlers/imageUpload';
import { createImageAssetViewHandler } from './preview/handlers/imageAssetView';
import { createVideoAssetViewHandler } from './preview/handlers/videoAssetView';

const upload = createDiskUpload({
  fileSizeBytes: 10 * 1024 * 1024,
});

/**
 * Create preview routes
 */
export function createPreviewRoutes(services: PreviewRoutesServices): Router {
  const router = express.Router();

  const resolvedServices: PreviewRoutesServices = {
    ...services,
    userCreditService: services.userCreditService ?? defaultUserCreditService,
    ...(services.keyframeService !== undefined ? { keyframeService: services.keyframeService } : {}),
    ...(services.assetService !== undefined ? { assetService: services.assetService } : {}),
  };

  const imageGenerateHandler = createImageGenerateHandler(resolvedServices);
  const imageStoryboardGenerateHandler = createImageStoryboardGenerateHandler(resolvedServices);
  const videoAvailabilityHandler = createVideoAvailabilityHandler(resolvedServices);
  const videoGenerateHandler = createVideoGenerateHandler(resolvedServices);
  const videoJobsHandler = createVideoJobsHandler(resolvedServices);
  const videoContentHandler = createVideoContentHandler(resolvedServices);
  const imageContentHandler = createImageContentHandler();
  const imageUploadHandler = createImageUploadHandler();
  const imageAssetViewHandler = createImageAssetViewHandler(resolvedServices);
  const videoAssetViewHandler = createVideoAssetViewHandler(resolvedServices);

  router.post('/generate', asyncHandler(imageGenerateHandler));
  router.post('/generate/storyboard', asyncHandler(imageStoryboardGenerateHandler));
  router.post('/upload', upload.single('file'), asyncHandler(imageUploadHandler));
  router.get('/image/view', asyncHandler(imageAssetViewHandler));
  router.get('/video/view', asyncHandler(videoAssetViewHandler));
  router.get('/video/availability', asyncHandler(videoAvailabilityHandler));
  router.post('/video/generate', asyncHandler(videoGenerateHandler));
  router.get('/video/jobs/:jobId', asyncHandler(videoJobsHandler));
  router.get('/video/content/:contentId', asyncHandler(videoContentHandler));
  router.get('/image/content/:contentId', asyncHandler(imageContentHandler));

  return router;
}

export function createPublicPreviewRoutes(
  services: Pick<PreviewRoutesServices, 'videoGenerationService' | 'videoContentAccessService'>
): Router {
  const router = express.Router();

  const publicVideoContentHandler = createPublicVideoContentHandler(services);

  router.get('/video/content/:contentId', asyncHandler(publicVideoContentHandler));

  return router;
}
