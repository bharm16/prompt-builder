import sharp from 'sharp';
import { logger } from '@infrastructure/Logger';
import type { AssetType } from '@shared/types/asset';

export interface ProcessedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
}

export interface ImageValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

export class ReferenceImageService {
  private readonly maxWidth: number;
  private readonly maxHeight: number;
  private readonly quality: number;
  private readonly maxFileSizeBytes: number;
  private readonly thumbnailSize: number;
  private readonly log = logger.child({ service: 'AssetReferenceImageService' });

  constructor(options: {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    maxFileSizeBytes?: number;
    thumbnailSize?: number;
  } = {}) {
    this.maxWidth = options.maxWidth || 1024;
    this.maxHeight = options.maxHeight || 1024;
    this.quality = options.quality || 85;
    this.maxFileSizeBytes = options.maxFileSizeBytes || 5 * 1024 * 1024;
    this.thumbnailSize = options.thumbnailSize || 200;
  }

  async processImage(imageBuffer: Buffer): Promise<ProcessedImageResult> {
    const operation = 'processImage';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      bufferSize: imageBuffer.length,
      maxSizeBytes: this.maxFileSizeBytes,
    });

    try {
      if (imageBuffer.length > this.maxFileSizeBytes) {
        throw new Error(
          `Image exceeds maximum size of ${this.maxFileSizeBytes / 1024 / 1024}MB`
        );
      }

      const metadata = await sharp(imageBuffer).metadata();
      const allowedFormats = ['jpeg', 'jpg', 'png', 'webp'];

      if (!metadata.format || !allowedFormats.includes(metadata.format)) {
        throw new Error(
          `Invalid image format: ${metadata.format || 'unknown'}. Allowed: ${allowedFormats.join(', ')}`
        );
      }

      let processed = sharp(imageBuffer);
      const width = metadata.width || 0;
      const height = metadata.height || 0;

      if (width > this.maxWidth || height > this.maxHeight) {
        processed = processed.resize(this.maxWidth, this.maxHeight, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      processed = processed.jpeg({ quality: this.quality });

      const outputBuffer = await processed.toBuffer();
      const outputMetadata = await sharp(outputBuffer).metadata();

      const result = {
        buffer: outputBuffer,
        width: outputMetadata.width || 0,
        height: outputMetadata.height || 0,
        format: 'jpeg',
        sizeBytes: outputBuffer.length,
      };

      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
      });

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async generateThumbnail(imageBuffer: Buffer): Promise<ProcessedImageResult> {
    const operation = 'generateThumbnail';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      bufferSize: imageBuffer.length,
      thumbnailSize: this.thumbnailSize,
    });

    try {
      const thumbnail = await sharp(imageBuffer)
        .resize(this.thumbnailSize, this.thumbnailSize, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 70 })
        .toBuffer();

      const metadata = await sharp(thumbnail).metadata();

      const result = {
        buffer: thumbnail,
        width: metadata.width || this.thumbnailSize,
        height: metadata.height || this.thumbnailSize,
        format: 'jpeg',
        sizeBytes: thumbnail.length,
      };

      this.log.info('Operation completed.', {
        operation,
        duration: Math.round(performance.now() - startTime),
        width: result.width,
        height: result.height,
        sizeBytes: result.sizeBytes,
      });

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async validateForAssetType(
    imageBuffer: Buffer,
    assetType: AssetType
  ): Promise<ImageValidationResult> {
    const operation = 'validateForAssetType';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      assetType,
      bufferSize: imageBuffer.length,
    });

    try {
      const metadata = await sharp(imageBuffer).metadata();

      const validations: ImageValidationResult = {
        isValid: true,
        warnings: [],
        errors: [],
      };

      const width = metadata.width || 0;
      const height = metadata.height || 0;
      const aspectRatio = height > 0 ? width / height : 0;

      if (assetType === 'character' && aspectRatio > 1.5) {
        validations.warnings.push(
          'Character reference images work best in portrait or square format'
        );
      }

      if (assetType === 'location' && aspectRatio > 0 && aspectRatio < 1) {
        validations.warnings.push(
          'Location reference images work best in landscape format'
        );
      }

      if (width < 256 || height < 256) {
        validations.errors.push('Image resolution too low. Minimum 256x256 pixels required.');
        validations.isValid = false;
      }

      this.log.info('Operation completed.', {
        operation,
        assetType,
        duration: Math.round(performance.now() - startTime),
        isValid: validations.isValid,
        warningCount: validations.warnings.length,
        errorCount: validations.errors.length,
      });

      return validations;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        assetType,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }
}

export default ReferenceImageService;
