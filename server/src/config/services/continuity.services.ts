import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { AIModelService } from '@services/ai-model/index';
import AssetService from '@services/asset/AssetService';
import { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import KeyframeGenerationService from '@services/generation/KeyframeGenerationService';
import { getStorageService } from '@services/storage/StorageService';
import { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import { createVideoAssetStore } from '@services/video-generation/storage';
import {
  AnchorService,
  CharacterKeyframeService,
  ContinuityMediaService,
  ContinuityPostProcessingService,
  ContinuityProviderService,
  ContinuitySessionService,
  ContinuitySessionStore,
  ContinuityShotGenerator,
  FrameBridgeService,
  GradingService,
  ProviderStyleAdapter,
  QualityGateService,
  SceneProxyService,
  SeedPersistenceService,
  StyleAnalysisService,
  StyleReferenceService,
} from '@services/continuity';

export function registerContinuityServices(container: DIContainer): void {
  container.register('continuitySessionStore', () => new ContinuitySessionStore(), [], { singleton: true });

  container.register(
    'frameBridgeService',
    (storageService: ReturnType<typeof getStorageService>) => new FrameBridgeService(storageService),
    ['storageService'],
    { singleton: true }
  );

  container.register(
    'styleReferenceService',
    (storageService: ReturnType<typeof getStorageService>) => new StyleReferenceService(storageService),
    ['storageService'],
    { singleton: true }
  );

  container.register(
    'characterKeyframeService',
    (
      keyframeGenerationService: KeyframeGenerationService | null,
      assetService: AssetService | null,
      storageService: ReturnType<typeof getStorageService>
    ) => {
      if (!keyframeGenerationService || !assetService) {
        logger.warn('CharacterKeyframeService disabled', {
          keyframeGenerationService: Boolean(keyframeGenerationService),
          assetService: Boolean(assetService),
        });
        return null;
      }
      return new CharacterKeyframeService(keyframeGenerationService, assetService, storageService);
    },
    ['keyframeGenerationService', 'assetService', 'storageService'],
    { singleton: true }
  );

  container.register('providerStyleAdapter', () => new ProviderStyleAdapter(), [], { singleton: true });
  container.register('seedPersistenceService', () => new SeedPersistenceService(), [], { singleton: true });

  container.register(
    'styleAnalysisService',
    (aiService: AIModelService) => new StyleAnalysisService(aiService),
    ['aiService'],
    { singleton: true }
  );

  container.register(
    'anchorService',
    (providerStyleAdapter: ProviderStyleAdapter) => new AnchorService(providerStyleAdapter),
    ['providerStyleAdapter'],
    { singleton: true }
  );

  container.register(
    'gradingService',
    (
      videoAssetStore: ReturnType<typeof createVideoAssetStore>,
      storageService: ReturnType<typeof getStorageService>
    ) => new GradingService(videoAssetStore, storageService),
    ['videoAssetStore', 'storageService'],
    { singleton: true }
  );

  container.register(
    'qualityGateService',
    (
      faceEmbeddingService: FaceEmbeddingService | null,
      storageService: ReturnType<typeof getStorageService>
    ) => new QualityGateService(faceEmbeddingService, storageService),
    ['faceEmbeddingService', 'storageService'],
    { singleton: true }
  );

  container.register(
    'sceneProxyService',
    (
      storageService: ReturnType<typeof getStorageService>,
      frameBridgeService: FrameBridgeService
    ) => new SceneProxyService(storageService, frameBridgeService),
    ['storageService', 'frameBridgeService'],
    { singleton: true }
  );

  container.register(
    'continuitySessionService',
    (
      anchorService: AnchorService,
      frameBridgeService: FrameBridgeService,
      styleReferenceService: StyleReferenceService,
      characterKeyframeService: CharacterKeyframeService | null,
      providerStyleAdapter: ProviderStyleAdapter,
      seedPersistenceService: SeedPersistenceService,
      styleAnalysisService: StyleAnalysisService,
      gradingService: GradingService,
      qualityGateService: QualityGateService,
      sceneProxyService: SceneProxyService,
      videoGenerationService: VideoGenerationService | null,
      assetService: AssetService | null,
      continuitySessionStore: ContinuitySessionStore
    ) => {
      if (!videoGenerationService || !assetService) {
        logger.warn('ContinuitySessionService disabled', {
          videoGenerationService: Boolean(videoGenerationService),
          assetService: Boolean(assetService),
        });
        return null;
      }

      if (!characterKeyframeService) {
        logger.warn('Character keyframe service unavailable; PuLID identity continuity will be disabled.');
      }

      const providerService = new ContinuityProviderService(
        anchorService,
        providerStyleAdapter,
        seedPersistenceService
      );
      const mediaService = new ContinuityMediaService(
        frameBridgeService,
        styleReferenceService,
        styleAnalysisService,
        videoGenerationService,
        assetService
      );
      const postProcessingService = new ContinuityPostProcessingService(
        gradingService,
        qualityGateService,
        sceneProxyService
      );
      const shotGenerator = new ContinuityShotGenerator(
        providerService,
        mediaService,
        postProcessingService,
        characterKeyframeService,
        continuitySessionStore
      );

      return new ContinuitySessionService(
        providerService,
        mediaService,
        postProcessingService,
        shotGenerator,
        continuitySessionStore
      );
    },
    [
      'anchorService',
      'frameBridgeService',
      'styleReferenceService',
      'characterKeyframeService',
      'providerStyleAdapter',
      'seedPersistenceService',
      'styleAnalysisService',
      'gradingService',
      'qualityGateService',
      'sceneProxyService',
      'videoGenerationService',
      'assetService',
      'continuitySessionStore',
    ]
  );
}
