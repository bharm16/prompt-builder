import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import type { MetricsService } from '@infrastructure/MetricsService';
import type { LLMClient } from '@clients/LLMClient';
import { AIModelService } from '@services/ai-model/index';
import AssetService from '@services/asset/AssetService';
import { CapabilitiesProbeService } from '@services/capabilities/CapabilitiesProbeService';
import type { UserCreditService } from '@services/credits/UserCreditService';
import ConsistentVideoService from '@services/generation/ConsistentVideoService';
import FaceSwapService from '@services/generation/FaceSwapService';
import KeyframeGenerationService from '@services/generation/KeyframeGenerationService';
import { FalFaceSwapProvider } from '@services/generation/providers/FalFaceSwapProvider';
import { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import { ReplicateFluxKontextFastProvider } from '@services/image-generation/providers/ReplicateFluxKontextFastProvider';
import { ReplicateFluxSchnellProvider } from '@services/image-generation/providers/ReplicateFluxSchnellProvider';
import { VideoToImagePromptTransformer } from '@services/image-generation/providers/VideoToImagePromptTransformer';
import type { ImagePreviewProvider } from '@services/image-generation/providers/types';
import type { ImageAssetStore } from '@services/image-generation/storage';
import {
  parseImagePreviewProviderOrder,
  resolveImagePreviewProviderSelection,
} from '@services/image-generation/providers/registry';
import { StoryboardFramePlanner } from '@services/image-generation/storyboard/StoryboardFramePlanner';
import { StoryboardPreviewService } from '@services/image-generation/storyboard/StoryboardPreviewService';
import { ModelIntelligenceService } from '@services/model-intelligence/ModelIntelligenceService';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { VideoJobWorker } from '@services/video-generation/jobs/VideoJobWorker';
import { createVideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import { ProviderCircuitManager } from '@services/video-generation/jobs/ProviderCircuitManager';
import { DlqReprocessorWorker } from '@services/video-generation/jobs/DlqReprocessorWorker';
import type { VideoAssetStore } from '@services/video-generation/storage';
import type { StorageService } from '@services/storage/StorageService';
import { VideoPromptDetectionService } from '@services/video-prompt-analysis/services/detection/VideoPromptDetectionService';
import type { ServiceConfig } from './service-config.types.ts';

export function registerGenerationServices(container: DIContainer): void {
  container.register('videoPromptDetector', () => new VideoPromptDetectionService(), []);

  container.register(
    'videoToImageTransformer',
    (geminiClient: LLMClient | null) => {
      if (!geminiClient) {
        logger.warn('Gemini client not available, video-to-image transformation disabled');
        return null;
      }
      return new VideoToImagePromptTransformer({
        llmClient: geminiClient,
        timeoutMs: 5000,
      });
    },
    ['geminiClient']
  );

  container.register(
    'storyboardFramePlanner',
    (geminiClient: LLMClient | null, claudeClient: LLMClient | null) => {
      if (!geminiClient) {
        logger.warn('Gemini client not available, storyboard frame planner disabled');
        return null;
      }
      if (!claudeClient) {
        logger.warn(
          'OpenAI client not available, vision-based storyboard planning disabled (text-only fallback)'
        );
      }
      return new StoryboardFramePlanner({
        llmClient: geminiClient,
        visionLlmClient: claudeClient,
        timeoutMs: 8000,
        visionTimeoutMs: 15000,
      });
    },
    ['geminiClient', 'claudeClient']
  );

  container.register(
    'replicateFluxSchnellProvider',
    (
      transformer: VideoToImagePromptTransformer | null,
      videoPromptDetector: VideoPromptDetectionService,
      config: ServiceConfig
    ) => {
      const apiToken = config.replicate.apiToken;
      if (!apiToken) {
        logger.warn('REPLICATE_API_TOKEN not provided, Replicate image provider disabled');
        return null;
      }
      return new ReplicateFluxSchnellProvider({ apiToken, promptTransformer: transformer, videoPromptDetector });
    },
    ['videoToImageTransformer', 'videoPromptDetector', 'config']
  );

  container.register(
    'replicateFluxKontextFastProvider',
    (
      transformer: VideoToImagePromptTransformer | null,
      videoPromptDetector: VideoPromptDetectionService,
      config: ServiceConfig
    ) => {
      const apiToken = config.replicate.apiToken;
      if (!apiToken) {
        logger.warn('REPLICATE_API_TOKEN not provided, Replicate image provider disabled');
        return null;
      }
      return new ReplicateFluxKontextFastProvider({
        apiToken,
        promptTransformer: transformer,
        videoPromptDetector,
      });
    },
    ['videoToImageTransformer', 'videoPromptDetector', 'config']
  );

  container.register(
    'imageGenerationService',
    (
      replicateProvider: ReplicateFluxSchnellProvider | null,
      kontextProvider: ReplicateFluxKontextFastProvider | null,
      imageAssetStore: ImageAssetStore
    ) => {
      const providers = [replicateProvider, kontextProvider].filter(Boolean) as ImagePreviewProvider[];

      if (providers.length === 0) {
        logger.warn('No image preview providers configured');
        return null;
      }

      const selection = resolveImagePreviewProviderSelection(
        process.env.IMAGE_PREVIEW_PROVIDER
      );
      if (process.env.IMAGE_PREVIEW_PROVIDER && !selection) {
        logger.warn('Invalid IMAGE_PREVIEW_PROVIDER value', {
          value: process.env.IMAGE_PREVIEW_PROVIDER,
        });
      }

      const fallbackOrder = parseImagePreviewProviderOrder(
        process.env.IMAGE_PREVIEW_PROVIDER_ORDER
      );
      if (process.env.IMAGE_PREVIEW_PROVIDER_ORDER && fallbackOrder.length === 0) {
        logger.warn('No valid IMAGE_PREVIEW_PROVIDER_ORDER entries found', {
          value: process.env.IMAGE_PREVIEW_PROVIDER_ORDER,
        });
      }

      return new ImageGenerationService({
        providers,
        assetStore: imageAssetStore,
        defaultProvider: selection ?? 'auto',
        fallbackOrder,
      });
    },
    ['replicateFluxSchnellProvider', 'replicateFluxKontextFastProvider', 'imageAssetStore']
  );

  container.register(
    'storyboardPreviewService',
    (
      imageGenerationService: ImageGenerationService | null,
      storyboardFramePlanner: StoryboardFramePlanner | null
    ) => {
      if (!imageGenerationService || !storyboardFramePlanner) {
        logger.warn('Storyboard preview service disabled', {
          imageGenerationServiceAvailable: Boolean(imageGenerationService),
          storyboardFramePlannerAvailable: Boolean(storyboardFramePlanner),
        });
        return null;
      }
      return new StoryboardPreviewService({
        imageGenerationService,
        storyboardFramePlanner,
      });
    },
    ['imageGenerationService', 'storyboardFramePlanner']
  );

  container.register(
    'videoGenerationService',
    (videoAssetStore: VideoAssetStore) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      const openAIKey = process.env.OPENAI_API_KEY;
      const lumaApiKey = process.env.LUMA_API_KEY || process.env.LUMAAI_API_KEY;
      const klingApiKey = process.env.KLING_API_KEY;
      const klingBaseUrl = process.env.KLING_API_BASE_URL;
      const geminiApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      const geminiBaseUrl = process.env.GEMINI_BASE_URL;
      if (!apiToken && !openAIKey && !lumaApiKey && !klingApiKey && !geminiApiKey) {
        logger.warn(
          'No video generation credentials provided (REPLICATE_API_TOKEN, OPENAI_API_KEY, LUMA_API_KEY or LUMAAI_API_KEY, KLING_API_KEY, or GEMINI_API_KEY)'
        );
        return null;
      }
      return new VideoGenerationService({
        assetStore: videoAssetStore,
        ...(apiToken ? { apiToken } : {}),
        ...(openAIKey ? { openAIKey } : {}),
        ...(lumaApiKey ? { lumaApiKey } : {}),
        ...(klingApiKey ? { klingApiKey } : {}),
        ...(klingBaseUrl ? { klingBaseUrl } : {}),
        ...(geminiApiKey ? { geminiApiKey } : {}),
        ...(geminiBaseUrl ? { geminiBaseUrl } : {}),
      });
    },
    ['videoAssetStore']
  );

  container.register(
    'modelIntelligenceService',
    (
      aiService: AIModelService,
      videoGenerationService: VideoGenerationService | null,
      creditService: UserCreditService,
      billingProfileStore: BillingProfileStore,
      metricsService: MetricsService
    ) =>
      new ModelIntelligenceService({
        aiService,
        videoGenerationService,
        userCreditService: creditService,
        billingProfileStore,
        metricsService,
      }),
    ['aiService', 'videoGenerationService', 'userCreditService', 'billingProfileStore', 'metricsService'],
    { singleton: true }
  );

  container.register(
    'keyframeGenerationService',
    (config: ServiceConfig) => {
      const falKey = config.fal.apiKey;
      if (!falKey) {
        logger.warn('KeyframeGenerationService: FAL_KEY/FAL_API_KEY not set, service will be unavailable');
        return null;
      }
      const replicateToken = config.replicate.apiToken;
      return new KeyframeGenerationService({
        falApiKey: falKey,
        ...(replicateToken ? { apiToken: replicateToken } : {}),
      });
    },
    ['config'],
    { singleton: true }
  );

  container.register(
    'keyframeService',
    (keyframeGenerationService: KeyframeGenerationService | null) => keyframeGenerationService,
    ['keyframeGenerationService']
  );

  container.register(
    'faceSwapService',
    (config: ServiceConfig) => {
      const falKey = config.fal.apiKey;
      if (!falKey) {
        logger.warn('FaceSwapService: FAL_KEY/FAL_API_KEY not set, service will be unavailable');
        return null;
      }
      const faceSwapProvider = new FalFaceSwapProvider({ apiKey: falKey });
      if (!faceSwapProvider.isAvailable()) {
        logger.warn('FaceSwapService: Fal face swap provider unavailable');
        return null;
      }
      return new FaceSwapService({ faceSwapProvider });
    },
    ['config'],
    { singleton: true }
  );

  container.register(
    'consistentVideoService',
    (
      videoGenerationService: VideoGenerationService | null,
      assetService: AssetService | null,
      keyframeGenerationService: KeyframeGenerationService | null
    ) => {
      if (!videoGenerationService || !assetService || !keyframeGenerationService) {
        logger.warn('Consistent video service disabled', {
          videoGenerationServiceAvailable: Boolean(videoGenerationService),
          assetServiceAvailable: Boolean(assetService),
          keyframeGenerationServiceAvailable: Boolean(keyframeGenerationService),
        });
        return null;
      }

      return new ConsistentVideoService({
        videoGenerationService,
        assetService,
        keyframeService: keyframeGenerationService,
      });
    },
    ['videoGenerationService', 'assetService', 'keyframeGenerationService']
  );

  container.register(
    'capabilitiesProbeService',
    () => new CapabilitiesProbeService(),
    [],
    { singleton: true }
  );

  container.register(
    'providerCircuitManager',
    (metricsService: MetricsService) => {
      const failureRateThreshold = Number.parseFloat(process.env.VIDEO_PROVIDER_CIRCUIT_FAILURE_RATE || '0.6');
      const minVolume = Number.parseInt(process.env.VIDEO_PROVIDER_CIRCUIT_MIN_VOLUME || '20', 10);
      const cooldownMs = Number.parseInt(process.env.VIDEO_PROVIDER_CIRCUIT_COOLDOWN_MS || '60000', 10);
      const maxSamples = Number.parseInt(process.env.VIDEO_PROVIDER_CIRCUIT_MAX_SAMPLES || '50', 10);

      return new ProviderCircuitManager({
        failureRateThreshold: Number.isFinite(failureRateThreshold) ? failureRateThreshold : 0.6,
        minVolume: Number.isFinite(minVolume) ? minVolume : 20,
        cooldownMs: Number.isFinite(cooldownMs) ? cooldownMs : 60_000,
        maxSamples: Number.isFinite(maxSamples) ? maxSamples : 50,
        metrics: metricsService,
      });
    },
    ['metricsService'],
    { singleton: true }
  );

  container.register(
    'videoJobWorker',
    (
      videoJobStore: VideoJobStore,
      videoGenerationService: VideoGenerationService | null,
      creditService: UserCreditService,
      storageService: StorageService,
      metricsService: MetricsService,
      providerCircuitManager: ProviderCircuitManager
    ) => {
      if (!videoGenerationService) {
        return null;
      }

      const pollIntervalMs = Number.parseInt(process.env.VIDEO_JOB_POLL_INTERVAL_MS || '2000', 10);
      const leaseSeconds = Number.parseInt(process.env.VIDEO_JOB_LEASE_SECONDS || '60', 10);
      const maxConcurrent = Number.parseInt(process.env.VIDEO_JOB_MAX_CONCURRENT || '2', 10);
      const heartbeatIntervalMs = Number.parseInt(
        process.env.VIDEO_JOB_HEARTBEAT_INTERVAL_MS || '20000',
        10
      );
      const perProviderMaxConcurrent = Number.parseInt(
        process.env.VIDEO_JOB_PER_PROVIDER_MAX_CONCURRENT || '',
        10
      );

      return new VideoJobWorker(videoJobStore, videoGenerationService, creditService, storageService, {
        pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 2000,
        leaseMs: Number.isFinite(leaseSeconds) ? leaseSeconds * 1000 : 60000,
        maxConcurrent: Number.isFinite(maxConcurrent) ? maxConcurrent : 2,
        heartbeatIntervalMs: Number.isFinite(heartbeatIntervalMs) ? heartbeatIntervalMs : 20000,
        providerCircuitManager,
        ...(Number.isFinite(perProviderMaxConcurrent) && perProviderMaxConcurrent > 0
          ? { perProviderMaxConcurrent }
          : {}),
        metrics: metricsService,
      });
    },
    ['videoJobStore', 'videoGenerationService', 'userCreditService', 'storageService', 'metricsService', 'providerCircuitManager']
  );

  container.register(
    'videoJobSweeper',
    (videoJobStore: VideoJobStore, creditService: UserCreditService, metricsService: MetricsService) =>
      createVideoJobSweeper(videoJobStore, creditService, metricsService),
    ['videoJobStore', 'userCreditService', 'metricsService'],
    { singleton: true }
  );

  container.register(
    'dlqReprocessorWorker',
    (
      videoJobStore: VideoJobStore,
      providerCircuitManager: ProviderCircuitManager,
      metricsService: MetricsService
    ) => {
      const disabled = process.env.VIDEO_DLQ_REPROCESSOR_DISABLED === 'true';
      if (disabled) {
        return null;
      }

      const pollIntervalMs = Number.parseInt(process.env.VIDEO_DLQ_POLL_INTERVAL_MS || '30000', 10);
      const maxEntriesPerRun = Number.parseInt(process.env.VIDEO_DLQ_MAX_ENTRIES_PER_RUN || '5', 10);

      return new DlqReprocessorWorker(videoJobStore, {
        pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 30_000,
        maxEntriesPerRun: Number.isFinite(maxEntriesPerRun) ? maxEntriesPerRun : 5,
        providerCircuitManager,
        metrics: metricsService,
      });
    },
    ['videoJobStore', 'providerCircuitManager', 'metricsService'],
    { singleton: true }
  );
}
