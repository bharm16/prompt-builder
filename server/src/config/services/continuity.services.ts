import type { DIContainer } from "@infrastructure/DIContainer";
import { logger } from "@infrastructure/Logger";
import { AIModelService } from "@services/ai-model/index";
import AssetService from "@services/asset/AssetService";
import { FaceEmbeddingService } from "@services/asset/FaceEmbeddingService";
import KeyframeGenerationService from "@services/video-generation/KeyframeGenerationService";
import type { StorageService as AppStorageService } from "@services/storage/StorageService";
import { VideoGenerationService } from "@services/video-generation/VideoGenerationService";
import type { VideoAssetStore } from "@services/video-generation/storage";
import {
  AnchorService,
  CharacterKeyframeService,
  ContinuityMediaService,
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
} from "@services/continuity";
import type { ServiceConfig } from "./service-config.types.ts";
import { createDepthEstimationServiceForUser } from "@services/convergence/depth";
import type { StorageService as ConvergenceStorageService } from "@services/convergence/storage";
import type { DepthEstimationFactory } from "@services/continuity/ports/DepthEstimationFactory";
import type { SessionStorePort } from "@services/continuity/ports/SessionStorePort";

export function registerContinuityServices(container: DIContainer): void {
  container.register(
    "continuitySessionStore",
    (sessionStore: SessionStorePort) =>
      new ContinuitySessionStore(sessionStore),
    ["sessionStore"],
  );

  container.register(
    "frameBridgeService",
    (storageService: AppStorageService) =>
      new FrameBridgeService(storageService),
    ["storageService"],
  );

  container.register(
    "styleReferenceService",
    (storageService: AppStorageService, config: ServiceConfig) =>
      new StyleReferenceService(
        storageService,
        config.replicate.apiToken,
        config.continuity.ipAdapterModel,
      ),
    ["storageService", "config"],
  );

  container.register(
    "characterKeyframeService",
    (
      keyframeGenerationService: KeyframeGenerationService | null,
      assetService: AssetService | null,
      storageService: AppStorageService,
    ) => {
      if (!keyframeGenerationService || !assetService) {
        logger.warn("CharacterKeyframeService disabled", {
          keyframeGenerationService: Boolean(keyframeGenerationService),
          assetService: Boolean(assetService),
        });
        return null;
      }
      return new CharacterKeyframeService(
        keyframeGenerationService,
        assetService,
        storageService,
      );
    },
    ["keyframeGenerationService", "assetService", "storageService"],
  );

  container.register(
    "providerStyleAdapter",
    () => new ProviderStyleAdapter(),
    [],
  );
  container.register(
    "seedPersistenceService",
    () => new SeedPersistenceService(),
    [],
  );

  container.register(
    "styleAnalysisService",
    (aiService: AIModelService) => new StyleAnalysisService(aiService),
    ["aiService"],
  );

  container.register(
    "anchorService",
    (providerStyleAdapter: ProviderStyleAdapter) =>
      new AnchorService(providerStyleAdapter),
    ["providerStyleAdapter"],
  );

  container.register(
    "gradingService",
    (videoAssetStore: VideoAssetStore, storageService: AppStorageService) =>
      new GradingService(videoAssetStore, storageService),
    ["videoAssetStore", "storageService"],
  );

  container.register(
    "qualityGateService",
    (
      faceEmbeddingService: FaceEmbeddingService | null,
      storageService: AppStorageService,
      config: ServiceConfig,
    ) =>
      new QualityGateService(faceEmbeddingService, storageService, {
        disableClip: config.continuity.disableClip,
      }),
    ["faceEmbeddingService", "storageService", "config"],
  );

  container.register(
    "continuityDepthEstimationFactory",
    (storageService: AppStorageService): DepthEstimationFactory =>
      (userId: string) =>
        createDepthEstimationServiceForUser(
          storageService as unknown as ConvergenceStorageService,
          userId,
        ),
    ["storageService"],
  );

  container.register(
    "sceneProxyService",
    (
      storageService: AppStorageService,
      frameBridgeService: FrameBridgeService,
      depthEstimationFactory: DepthEstimationFactory,
    ) =>
      new SceneProxyService(
        storageService,
        frameBridgeService,
        depthEstimationFactory,
      ),
    [
      "storageService",
      "frameBridgeService",
      "continuityDepthEstimationFactory",
    ],
  );

  container.register(
    "continuitySessionService",
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
      continuitySessionStore: ContinuitySessionStore,
      storageService: AppStorageService,
    ) => {
      if (!videoGenerationService || !assetService) {
        logger.warn("ContinuitySessionService disabled", {
          videoGenerationService: Boolean(videoGenerationService),
          assetService: Boolean(assetService),
        });
        return null;
      }

      if (!characterKeyframeService) {
        logger.warn(
          "Character keyframe service unavailable; PuLID identity continuity will be disabled.",
        );
      }

      const mediaService = new ContinuityMediaService(
        frameBridgeService,
        styleReferenceService,
        styleAnalysisService,
        videoGenerationService,
        assetService,
        storageService,
      );
      const shotGenerator = new ContinuityShotGenerator(
        providerStyleAdapter,
        anchorService,
        seedPersistenceService,
        mediaService,
        gradingService,
        qualityGateService,
        sceneProxyService,
        characterKeyframeService,
        continuitySessionStore,
      );

      return new ContinuitySessionService(
        providerStyleAdapter,
        mediaService,
        sceneProxyService,
        shotGenerator,
        continuitySessionStore,
      );
    },
    [
      "anchorService",
      "frameBridgeService",
      "styleReferenceService",
      "characterKeyframeService",
      "providerStyleAdapter",
      "seedPersistenceService",
      "styleAnalysisService",
      "gradingService",
      "qualityGateService",
      "sceneProxyService",
      "videoGenerationService",
      "assetService",
      "continuitySessionStore",
      "storageService",
    ],
  );
}
