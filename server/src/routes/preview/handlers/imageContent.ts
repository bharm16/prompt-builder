/**
 * Image Content Handler
 *
 * Serves locally stored images in development.
 * In production, GCS signed URLs are used directly.
 */

import type { Request, Response } from 'express';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { logger } from '@infrastructure/Logger';

const log = logger.child({ handler: 'imageContent' });
const IMAGE_STORAGE_DIR = process.env.IMAGE_STORAGE_DIR || './storage/images';

export const createImageContentHandler = () =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const { contentId } = req.params as { contentId?: string };
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'contentId is required',
      });
    }

    // Sanitize contentId to prevent path traversal
    const idPart = contentId.split('.')[0];
    const sanitizedId = idPart ? path.basename(idPart) : '';
    if (!sanitizedId || sanitizedId.includes('..')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid contentId',
      });
    }

    const directory = path.resolve(IMAGE_STORAGE_DIR);
    
    try {
      const files = await fs.readdir(directory);
      const matchingFile = files.find((f) => f.startsWith(sanitizedId));
      
      if (!matchingFile) {
        return res.status(404).json({
          success: false,
          error: 'Image not found',
        });
      }

      const filePath = path.join(directory, matchingFile);
      const stats = await fs.stat(filePath);
      const buffer = await fs.readFile(filePath);

      // Determine content type from extension
      const ext = path.extname(matchingFile).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.webp': 'image/webp',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
      };
      const contentType = contentTypes[ext] || 'image/webp';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', stats.size);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      return res.send(buffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('Failed to serve image', { message: errorMessage });

      return res.status(404).json({
        success: false,
        error: 'Image not found',
      });
    }
  };
