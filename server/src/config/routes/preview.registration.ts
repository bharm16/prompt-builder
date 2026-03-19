/**
 * Preview Route Registration
 *
 * Registers image and video generation preview routes.
 * Gated by PROMPT_OUTPUT_ONLY flag. Auth + starter credits required.
 */

import type { Application } from 'express';
import type { DIContainer } from '@infrastructure/DIContainer';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createStarterCreditsMiddleware } from '@middleware/starterCredits';
import { createPreviewRoutes } from '@routes/preview.routes';
import type { PreviewRoutesServices } from '@routes/types';
import { resolveOptionalService } from './resolve-utils.ts';
import type { RuntimeFlags } from '../runtime-flags';

export function registerPreviewRoutes(
  app: Application,
  container: DIContainer,
  runtimeFlags: RuntimeFlags,
): void {
  if (runtimeFlags.promptOutputOnly) return;

  const userCreditService = container.resolve('userCreditService');
  const videoGenerationService = resolveOptionalService<PreviewRoutesServices['videoGenerationService']>(
    container,
    'videoGenerationService',
    'preview'
  );

  const previewRoutes = createPreviewRoutes({
    imageGenerationService: container.resolve('imageGenerationService'),
    storyboardPreviewService: container.resolve('storyboardPreviewService'),
    videoGenerationService,
    videoJobStore: container.resolve('videoJobStore'),
    videoContentAccessService: container.resolve('videoContentAccessService'),
    userCreditService,
    storageService: container.resolve('storageService'),
    keyframeService: container.resolve('keyframeGenerationService'),
    faceSwapService: container.resolve('faceSwapService'),
    assetService: container.resolve('assetService'),
    requestIdempotencyService: container.resolve('requestIdempotencyService'),
  });

  const starterCreditsMiddleware = createStarterCreditsMiddleware(userCreditService);
  app.use('/api/preview', apiAuthMiddleware, starterCreditsMiddleware, previewRoutes);
}
