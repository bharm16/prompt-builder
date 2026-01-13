import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PreviewRoutesServices } from '@routes/types';
import { getAuthenticatedUserId } from '../auth';

type ImageGenerateServices = Pick<PreviewRoutesServices, 'imageGenerationService'>;

export const createImageGenerateHandler = ({
  imageGenerationService,
}: ImageGenerateServices) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    if (!imageGenerationService) {
      return res.status(503).json({
        success: false,
        error: 'Image generation service is not available',
        message: 'REPLICATE_API_TOKEN is not configured',
      });
    }

    const { prompt, aspectRatio } = (req.body || {}) as {
      prompt?: unknown;
      aspectRatio?: unknown;
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Prompt must be a non-empty string',
      });
    }

    if (aspectRatio !== undefined && typeof aspectRatio !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'aspectRatio must be a string',
      });
    }

    const userId = await getAuthenticatedUserId(req);
    try {
      const result = await imageGenerationService.generatePreview(prompt, {
        ...(aspectRatio ? { aspectRatio } : {}),
        ...(userId ? { userId } : {}),
      });

      return res.json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = (error as { statusCode?: number }).statusCode || 500;
      const errorInstance = error instanceof Error ? error : new Error(errorMessage);

      logger.error('Image preview generation failed', errorInstance, {
        statusCode,
        userId,
        aspectRatio,
      });

      return res.status(statusCode).json({
        success: false,
        error: 'Image generation failed',
        message: errorMessage,
      });
    }
  };
