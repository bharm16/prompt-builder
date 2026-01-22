import type { Asset, AssetListResponse, AssetType, CreateAssetRequest, UpdateAssetRequest } from '@shared/types/asset';
import AssetRepository, { type ReferenceImageMetadataInput } from './AssetRepository';
import ReferenceImageService from './ReferenceImageService';
import AssetResolverService from './AssetResolverService';
import TriggerValidationService from './TriggerValidationService';
import FaceEmbeddingService from './FaceEmbeddingService';
import { logger } from '@infrastructure/Logger';

export class AssetService {
  private readonly repository: AssetRepository;
  private readonly imageService: ReferenceImageService;
  private readonly resolver: AssetResolverService;
  private readonly triggerValidation: TriggerValidationService;
  private readonly embeddingService: FaceEmbeddingService | null;
  private readonly log = logger.child({ service: 'AssetService' });

  constructor(
    assetRepository = new AssetRepository(),
    referenceImageService = new ReferenceImageService(),
    resolverService = new AssetResolverService(assetRepository),
    triggerValidation = new TriggerValidationService(),
    embeddingService: FaceEmbeddingService | null = null
  ) {
    this.repository = assetRepository;
    this.imageService = referenceImageService;
    this.resolver = resolverService;
    this.triggerValidation = triggerValidation;
    if (embeddingService) {
      this.embeddingService = embeddingService;
    } else if (process.env.REPLICATE_API_TOKEN) {
      this.embeddingService = new FaceEmbeddingService();
    } else {
      this.embeddingService = null;
    }
  }

  async createAsset(userId: string, payload: CreateAssetRequest): Promise<Asset> {
    const { type, trigger, name, textDefinition, negativePrompt } = payload;
    const validTypes: AssetType[] = ['character', 'style', 'location', 'object'];

    if (!validTypes.includes(type)) {
      throw new Error(`Invalid asset type: ${type}. Must be one of: ${validTypes.join(', ')}`);
    }

    const triggerResult = this.triggerValidation.validate(trigger);
    if (!triggerResult.isValid) {
      throw new Error(`Invalid trigger: ${triggerResult.errors.join(', ')}`);
    }

    const normalizedTrigger = this.triggerValidation.normalize(trigger);
    const exists = await this.repository.triggerExists(userId, normalizedTrigger);
    if (exists) {
      throw new Error(`Trigger "${trigger}" is already in use`);
    }

    if (!name || name.trim().length === 0) {
      throw new Error('Asset name is required');
    }
    if (name.length > 50) {
      throw new Error('Asset name must be 50 characters or less');
    }

    const trimmedDefinition = textDefinition?.trim() ?? '';
    if (type !== 'character' && trimmedDefinition.length === 0) {
      throw new Error('Text definition is required for this asset type');
    }
    if (trimmedDefinition.length > 1000) {
      throw new Error('Text definition must be 1000 characters or less');
    }

    return await this.repository.create(userId, {
      type,
      trigger: normalizedTrigger,
      name: name.trim(),
      textDefinition: trimmedDefinition,
      negativePrompt: negativePrompt?.trim() || '',
    });
  }

  async getAsset(userId: string, assetId: string): Promise<Asset> {
    const asset = await this.repository.getById(userId, assetId);
    if (!asset) {
      throw new Error(`Asset not found: ${assetId}`);
    }
    return asset;
  }

  async listAssets(
    userId: string,
    options: { limit?: number; orderByField?: string; type?: AssetType | null } = {}
  ): Promise<AssetListResponse> {
    const assets = await this.repository.getAll(userId, options);

    const byType: AssetListResponse['byType'] = {
      character: 0,
      style: 0,
      location: 0,
      object: 0,
    };

    for (const asset of assets) {
      if (asset.type in byType) {
        byType[asset.type] += 1;
      }
    }

    return {
      assets,
      total: assets.length,
      byType,
    };
  }

  async listAssetsByType(userId: string, type: AssetType): Promise<Asset[]> {
    return await this.repository.getByType(userId, type);
  }

  async updateAsset(userId: string, assetId: string, updates: UpdateAssetRequest): Promise<Asset | null> {
    const asset = await this.getAsset(userId, assetId);

    const allowedUpdates: Partial<Asset> = {};

    if (updates.trigger !== undefined) {
      const triggerResult = this.triggerValidation.validate(updates.trigger);
      if (!triggerResult.isValid) {
        throw new Error(`Invalid trigger: ${triggerResult.errors.join(', ')}`);
      }

      const normalized = this.triggerValidation.normalize(updates.trigger);
      const exists = await this.repository.triggerExists(userId, normalized, assetId);
      if (exists) {
        throw new Error(`Trigger "${updates.trigger}" is already in use`);
      }

      allowedUpdates.trigger = normalized;
    }

    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        throw new Error('Asset name cannot be empty');
      }
      if (updates.name.length > 50) {
        throw new Error('Asset name must be 50 characters or less');
      }
      allowedUpdates.name = updates.name.trim();
    }

    if (updates.textDefinition !== undefined) {
      const trimmedDefinition = updates.textDefinition.trim();
      if (trimmedDefinition.length === 0 && asset.type !== 'character') {
        throw new Error('Text definition cannot be empty');
      }
      if (trimmedDefinition.length > 1000) {
        throw new Error('Text definition must be 1000 characters or less');
      }
      allowedUpdates.textDefinition = trimmedDefinition;
    }

    if (updates.negativePrompt !== undefined) {
      allowedUpdates.negativePrompt = updates.negativePrompt.trim();
    }

    return await this.repository.update(userId, assetId, allowedUpdates);
  }

  async deleteAsset(userId: string, assetId: string): Promise<boolean> {
    await this.getAsset(userId, assetId);
    return await this.repository.delete(userId, assetId);
  }

  async addReferenceImage(
    userId: string,
    assetId: string,
    imageBuffer: Buffer,
    metadata: ReferenceImageMetadataInput = {}
  ): Promise<{ image: Asset['referenceImages'][number]; warnings: string[] }> {
    const asset = await this.getAsset(userId, assetId);

    const maxImages = asset.type === 'character' ? 10 : 5;
    if ((asset.referenceImages || []).length >= maxImages) {
      throw new Error(`Maximum ${maxImages} reference images per ${asset.type}`);
    }

    const validation = await this.imageService.validateForAssetType(imageBuffer, asset.type);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    const processedImage = await this.imageService.processImage(imageBuffer);
    const thumbnail = await this.imageService.generateThumbnail(processedImage.buffer);

    const referenceImage = await this.repository.addReferenceImage(
      userId,
      assetId,
      {
        buffer: processedImage.buffer,
        width: processedImage.width,
        height: processedImage.height,
        sizeBytes: processedImage.sizeBytes,
        format: processedImage.format,
      },
      {
        buffer: thumbnail.buffer,
        width: thumbnail.width,
        height: thumbnail.height,
        sizeBytes: thumbnail.sizeBytes,
        format: thumbnail.format,
      },
      {
        ...metadata,
        width: processedImage.width,
        height: processedImage.height,
      }
    );

    if (asset.type === 'character' && this.embeddingService) {
      const updatedAsset = await this.getAsset(userId, assetId);
      const isPrimary =
        referenceImage.isPrimary ||
        (updatedAsset.referenceImages || []).length === 1;
      if (isPrimary) {
        try {
          await this.extractAndStoreFaceEmbedding(userId, assetId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.log.warn('Face embedding extraction failed', { assetId, message });
        }
      }
    }

    return {
      image: referenceImage,
      warnings: validation.warnings,
    };
  }

  async deleteReferenceImage(userId: string, assetId: string, imageId: string): Promise<boolean> {
    await this.getAsset(userId, assetId);
    return await this.repository.deleteReferenceImage(userId, assetId, imageId);
  }

  async setPrimaryImage(userId: string, assetId: string, imageId: string): Promise<Asset | null> {
    const asset = await this.getAsset(userId, assetId);
    const imageExists = asset.referenceImages?.some((img) => img.id === imageId);
    if (!imageExists) {
      throw new Error(`Image not found: ${imageId}`);
    }
    return await this.repository.setPrimaryImage(userId, assetId, imageId);
  }

  async resolvePrompt(userId: string, rawPrompt: string) {
    return await this.resolver.resolvePrompt(userId, rawPrompt);
  }

  async getSuggestions(userId: string, partialTrigger: string) {
    return await this.resolver.getSuggestions(userId, partialTrigger);
  }

  async validateTriggers(userId: string, rawPrompt: string) {
    return await this.resolver.validateTriggers(userId, rawPrompt);
  }

  async getAssetForGeneration(userId: string, assetId: string): Promise<{
    id: string;
    type: AssetType;
    trigger: string;
    name: string;
    textDefinition: string;
    negativePrompt?: string;
    primaryImageUrl: string | null;
    referenceImages: Asset['referenceImages'];
    faceEmbedding?: string | null;
  }> {
    const asset = await this.getAsset(userId, assetId);

    if (asset.type === 'character' && !(asset.referenceImages || []).length) {
      throw new Error('Character has no reference images. Add at least one reference image.');
    }

    const primaryImage =
      asset.referenceImages?.find((image) => image.isPrimary) || asset.referenceImages?.[0];

    await this.repository.incrementUsage(userId, assetId);

    return {
      id: asset.id,
      type: asset.type,
      trigger: asset.trigger,
      name: asset.name,
      textDefinition: asset.textDefinition,
      negativePrompt: asset.negativePrompt,
      primaryImageUrl: primaryImage?.url || null,
      referenceImages: asset.referenceImages || [],
      faceEmbedding: asset.faceEmbedding,
    };
  }

  async generateDescriptionFromImage(_userId: string, _assetId: string, _imageId?: string | null) {
    throw new Error('AI description generation not yet implemented');
  }

  async extractAndStoreFaceEmbedding(userId: string, assetId: string) {
    if (!this.embeddingService) {
      throw new Error('Face embedding service is not configured');
    }
    const asset = await this.getAsset(userId, assetId);

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

    return result;
  }
}

export default AssetService;
