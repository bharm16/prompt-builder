import type {
  Asset,
  AssetListResponse,
  AssetType,
  CreateAssetRequest,
  UpdateAssetRequest,
} from '@shared/types/asset';
import type AssetRepository from '../AssetRepository';
import type TriggerValidationService from '../TriggerValidationService';
import { logger } from '@infrastructure/Logger';

export class AssetCrudService {
  private readonly repository: AssetRepository;
  private readonly triggerValidation: TriggerValidationService;
  private readonly log = logger.child({ service: 'AssetCrudService' });

  constructor(repository: AssetRepository, triggerValidation: TriggerValidationService) {
    this.repository = repository;
    this.triggerValidation = triggerValidation;
  }

  async createAsset(userId: string, payload: CreateAssetRequest): Promise<Asset> {
    const { type, trigger, name, textDefinition, negativePrompt } = payload;
    const validTypes: AssetType[] = ['character', 'style', 'location', 'object'];
    const operation = 'createAsset';
    const startTime = performance.now();

    this.log.debug('Starting operation.', {
      operation,
      userId,
      type,
      triggerLength: trigger.length,
      nameLength: name.length,
      hasTextDefinition: Boolean(textDefinition?.trim()),
      hasNegativePrompt: Boolean(negativePrompt?.trim()),
    });

    try {
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

      const asset = await this.repository.create(userId, {
        type,
        trigger: normalizedTrigger,
        name: name.trim(),
        textDefinition: trimmedDefinition,
        negativePrompt: negativePrompt?.trim() || '',
      });

      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId: asset.id,
        type: asset.type,
        duration: Math.round(performance.now() - startTime),
      });

      return asset;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        type,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async getAsset(userId: string, assetId: string): Promise<Asset> {
    const operation = 'getAsset';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId });

    try {
      const asset = await this.repository.getById(userId, assetId);
      if (!asset) {
        throw new Error(`Asset not found: ${assetId}`);
      }
      this.log.debug('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      return asset;
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

  async listAssets(
    userId: string,
    options: { limit?: number; orderByField?: string; type?: AssetType | null } = {}
  ): Promise<AssetListResponse> {
    const operation = 'listAssets';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      type: options.type ?? null,
      limit: options.limit,
      orderByField: options.orderByField,
    });

    try {
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

      const result = {
        assets,
        total: assets.length,
        byType,
      };

      this.log.info('Operation completed.', {
        operation,
        userId,
        total: result.total,
        duration: Math.round(performance.now() - startTime),
      });

      return result;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async listAssetsByType(userId: string, type: AssetType): Promise<Asset[]> {
    const operation = 'listAssetsByType';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, type });

    try {
      const assets = await this.repository.getByType(userId, type);
      this.log.info('Operation completed.', {
        operation,
        userId,
        type,
        count: assets.length,
        duration: Math.round(performance.now() - startTime),
      });
      return assets;
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.log.error('Operation failed.', errorObj, {
        operation,
        userId,
        type,
        duration: Math.round(performance.now() - startTime),
      });
      throw error;
    }
  }

  async updateAsset(userId: string, assetId: string, updates: UpdateAssetRequest): Promise<Asset | null> {
    const operation = 'updateAsset';
    const startTime = performance.now();
    this.log.debug('Starting operation.', {
      operation,
      userId,
      assetId,
      updateKeys: Object.keys(updates),
    });

    try {
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

      const updated = await this.repository.update(userId, assetId, allowedUpdates);
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        duration: Math.round(performance.now() - startTime),
      });
      return updated;
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

  async deleteAsset(userId: string, assetId: string): Promise<boolean> {
    const operation = 'deleteAsset';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId });

    try {
      await this.getAsset(userId, assetId);
      const deleted = await this.repository.delete(userId, assetId);
      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        deleted,
        duration: Math.round(performance.now() - startTime),
      });
      return deleted;
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
    const operation = 'getAssetForGeneration';
    const startTime = performance.now();
    this.log.debug('Starting operation.', { operation, userId, assetId });

    try {
      const asset = await this.getAsset(userId, assetId);

      if (asset.type === 'character' && !(asset.referenceImages || []).length) {
        throw new Error('Character has no reference images. Add at least one reference image.');
      }

      const primaryImage =
        asset.referenceImages?.find((image) => image.isPrimary) || asset.referenceImages?.[0];

      await this.repository.incrementUsage(userId, assetId);

      const result = {
        id: asset.id,
        type: asset.type,
        trigger: asset.trigger,
        name: asset.name,
        textDefinition: asset.textDefinition,
        primaryImageUrl: primaryImage?.url || null,
        referenceImages: asset.referenceImages || [],
        ...(asset.negativePrompt !== undefined
          ? { negativePrompt: asset.negativePrompt }
          : {}),
        ...(asset.faceEmbedding !== undefined
          ? { faceEmbedding: asset.faceEmbedding }
          : {}),
      };

      this.log.info('Operation completed.', {
        operation,
        userId,
        assetId,
        type: asset.type,
        referenceImageCount: result.referenceImages.length,
        duration: Math.round(performance.now() - startTime),
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
