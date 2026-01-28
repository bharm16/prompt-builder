import type AssetRepository from '../AssetRepository';
import FaceEmbeddingService from '../FaceEmbeddingService';
import { logger } from '@infrastructure/Logger';
import type { AssetCrudService } from './AssetCrudService';

export class AssetEmbeddingService {
  private readonly repository: AssetRepository;
  private readonly embeddingService: FaceEmbeddingService;
  private readonly assetCrud: AssetCrudService;
  private readonly log = logger.child({ service: 'AssetEmbeddingService' });

  constructor(
    repository: AssetRepository,
    embeddingService: FaceEmbeddingService,
    assetCrud: AssetCrudService
  ) {
    this.repository = repository;
    this.embeddingService = embeddingService;
    this.assetCrud = assetCrud;
  }

  async extractAndStoreFaceEmbedding(userId: string, assetId: string) {
    const operation = 'extractAndStoreFaceEmbedding';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId });

    try {
      if (!this.embeddingService) {
        throw new Error('Face embedding service is not configured');
      }
      const asset = await this.assetCrud.getAsset(userId, assetId);

      if (asset.type !== 'character') {
        throw new Error('Face embedding only available for character assets');
      }

      const primaryImage =
        asset.referenceImages?.find((image) => image.isPrimary) || asset.referenceImages?.[0];

      if (!primaryImage) {
        throw new Error('No reference image available for embedding extraction');
      }

      const result = await this.embeddingService.extractEmbedding(primaryImage.url);
      const serializedEmbedding = this.embeddingService.serializeEmbedding(result.embedding);

      await this.repository.update(userId, assetId, {
        faceEmbedding: serializedEmbedding,
      });

      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
        confidence: result.confidence,
      });

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }
}
