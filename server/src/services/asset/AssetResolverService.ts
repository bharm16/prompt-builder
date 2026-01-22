import { logger } from '@infrastructure/Logger';
import type { Asset, AssetType, ResolvedPrompt } from '@shared/types/asset';
import AssetRepository from './AssetRepository';

export class AssetResolverService {
  private readonly repository: AssetRepository;
  private readonly log = logger.child({ service: 'AssetResolverService' });

  constructor(assetRepository: AssetRepository = new AssetRepository()) {
    this.repository = assetRepository;
  }

  extractTriggers(text: string): string[] {
    const matches = text.match(/@[a-zA-Z][a-zA-Z0-9_]*/g) || [];
    return [...new Set(matches.map((trigger) => trigger.toLowerCase()))];
  }

  async resolvePrompt(userId: string, rawPrompt: string): Promise<ResolvedPrompt> {
    const triggers = this.extractTriggers(rawPrompt);

    if (triggers.length === 0) {
      return {
        originalText: rawPrompt,
        expandedText: rawPrompt,
        assets: [],
        characters: [],
        styles: [],
        locations: [],
        objects: [],
        requiresKeyframe: false,
        negativePrompts: [],
        referenceImages: [],
      };
    }

    const assets = await this.repository.getByTriggers(userId, triggers);

    const characters = assets.filter((asset) => asset.type === 'character');
    const styles = assets.filter((asset) => asset.type === 'style');
    const locations = assets.filter((asset) => asset.type === 'location');
    const objects = assets.filter((asset) => asset.type === 'object');

    let expandedText = rawPrompt;
    const expansionTracker = new Map<string, boolean>();

    for (const asset of assets) {
      expandedText = this.expandTrigger(expandedText, asset, expansionTracker);
    }

    const styleModifiers = styles
      .map((style) => style.textDefinition)
      .filter(Boolean)
      .join(', ');

    if (styleModifiers) {
      expandedText = `${expandedText}, ${styleModifiers}`;
    }

    const negativePrompts = assets
      .map((asset) => asset.negativePrompt || '')
      .filter((value) => Boolean(value));

    const requiresKeyframe = characters.some(
      (character) => Boolean(character.faceEmbedding) || Boolean(character.referenceImages?.length)
    );

    await Promise.allSettled(
      assets.map(async (asset) => {
        try {
          await this.repository.incrementUsage(userId, asset.id);
          await this.repository.createUsageRecord(userId, {
            assetId: asset.id,
            assetType: asset.type,
            promptText: rawPrompt,
            expandedText,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.log.warn('Failed to record asset usage', {
            assetId: asset.id,
            error: errorMessage,
          });
        }
      })
    );

    return {
      originalText: rawPrompt,
      expandedText,
      assets,
      characters,
      styles,
      locations,
      objects,
      requiresKeyframe,
      negativePrompts,
      referenceImages: this.collectReferenceImages(assets),
    };
  }

  expandTrigger(text: string, asset: Asset, expansionTracker: Map<string, boolean>): string {
    const escapedTrigger = asset.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const triggerRegex = new RegExp(escapedTrigger, 'gi');
    const trackingKey = asset.trigger.toLowerCase();

    return text.replace(triggerRegex, () => {
      if (!expansionTracker.has(trackingKey)) {
        expansionTracker.set(trackingKey, true);
        if (asset.textDefinition) {
          return `${asset.name} (${asset.textDefinition})`;
        }
        return asset.name;
      }
      return asset.name;
    });
  }

  collectReferenceImages(assets: Asset[]): Array<{
    assetId: string;
    assetType: AssetType;
    assetName?: string;
    imageUrl: string;
  }> {
    return assets
      .filter((asset) => (asset.referenceImages || []).length > 0)
      .map((asset) => {
        const primary =
          asset.referenceImages.find((image) => image.isPrimary) || asset.referenceImages[0];
        return {
          assetId: asset.id,
          assetType: asset.type,
          assetName: asset.name,
          imageUrl: primary.url,
        };
      });
  }

  async getSuggestions(
    userId: string,
    partialTrigger: string,
    limit = 10
  ): Promise<
    Array<{
      id: string;
      type: AssetType;
      trigger: string;
      name: string;
      thumbnailUrl?: string;
    }>
  > {
    const allAssets = await this.repository.getAll(userId, { limit: 100 });
    const normalized = partialTrigger.toLowerCase().replace('@', '');

    return allAssets
      .filter(
        (asset) =>
          asset.trigger.toLowerCase().includes(normalized) ||
          asset.name.toLowerCase().includes(normalized)
      )
      .slice(0, limit)
      .map((asset) => ({
        id: asset.id,
        type: asset.type,
        trigger: asset.trigger,
        name: asset.name,
        thumbnailUrl: asset.referenceImages?.[0]?.thumbnailUrl,
      }));
  }

  async validateTriggers(userId: string, rawPrompt: string): Promise<{
    isValid: boolean;
    missingTriggers: string[];
    foundAssets: Asset[];
  }> {
    const triggers = this.extractTriggers(rawPrompt);
    const assets = await this.repository.getByTriggers(userId, triggers);
    const foundTriggers = new Set(assets.map((asset) => asset.trigger.toLowerCase()));
    const missingTriggers = triggers.filter((trigger) => !foundTriggers.has(trigger.toLowerCase()));

    return {
      isValid: missingTriggers.length === 0,
      missingTriggers,
      foundAssets: assets,
    };
  }
}

export default AssetResolverService;
