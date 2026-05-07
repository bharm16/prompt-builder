import type { Bucket } from "@google-cloud/storage";
import type { DIContainer } from "@infrastructure/DIContainer";
import { logger } from "@infrastructure/Logger";
import type { MetricsService } from "@infrastructure/MetricsService";
import type { LLMClient } from "@clients/LLMClient";
import { AIModelService } from "@services/ai-model/index";
import AssetService from "@services/asset/AssetService";
import { CapabilitiesProbeService } from "@services/capabilities/CapabilitiesProbeService";
import type { UserCreditService } from "@services/credits/UserCreditService";
import { labelSpans } from "@llm/span-labeling/SpanLabelingService";
import ConsistentVideoService from "@services/video-generation/ConsistentVideoService";
import FaceSwapService from "@services/video-generation/FaceSwapService";
import KeyframeGenerationService from "@services/video-generation/KeyframeGenerationService";
import { FalFaceSwapProvider } from "@services/video-generation/providers/FalFaceSwapProvider";
import { ImageGenerationService } from "@services/image-generation/ImageGenerationService";
import { ReplicateFluxKontextFastProvider } from "@services/image-generation/providers/ReplicateFluxKontextFastProvider";
import { ReplicateFluxSchnellProvider } from "@services/image-generation/providers/ReplicateFluxSchnellProvider";
import { VideoToImagePromptTransformer } from "@services/image-generation/providers/VideoToImagePromptTransformer";
import type { ImagePreviewProvider } from "@services/image-generation/providers/types";
import type { ImageAssetStore } from "@services/image-generation/storage";
import {
  parseImagePreviewProviderOrder,
  resolveImagePreviewProviderSelection,
} from "@services/image-generation/providers/registry";
import { StoryboardFramePlanner } from "@services/image-generation/storyboard/StoryboardFramePlanner";
import { StoryboardPreviewService } from "@services/image-generation/storyboard/StoryboardPreviewService";
import { ModelIntelligenceService } from "@services/model-intelligence/ModelIntelligenceService";
import { AvailabilityGateService } from "@services/model-intelligence/services/AvailabilityGateService";
import type { PromptSpanProvider } from "@services/model-intelligence/ports/PromptSpanProvider";
import { BillingProfileStore } from "@services/payment/BillingProfileStore";
import type { FirestoreCircuitExecutor } from "@services/firestore/FirestoreCircuitExecutor";
import { VideoGenerationService } from "@services/video-generation/VideoGenerationService";
import { VideoJobStore } from "@services/video-generation/jobs/VideoJobStore";
import { VideoWorkerHeartbeatStore } from "@services/video-generation/jobs/VideoWorkerHeartbeatStore";
import { VideoJobHandler } from "@services/video-generation/jobs/VideoJobHandler";
import type { SessionService } from "@services/sessions/SessionService";
import { VideoJobWorker } from "@services/video-generation/jobs/VideoJobWorker";
import { createVideoJobSweeper } from "@services/video-generation/jobs/VideoJobSweeper";
import { createVideoJobReconciler } from "@services/video-generation/jobs/VideoJobReconciler";
import { ProviderCircuitManager } from "@services/video-generation/jobs/ProviderCircuitManager";
import { DlqReprocessorWorker } from "@services/video-generation/jobs/DlqReprocessorWorker";
import type { VideoAssetStore } from "@services/video-generation/storage";
import type { StorageService } from "@services/storage/StorageService";
import { setTimeoutPolicyConfig } from "@services/video-generation/providers/timeoutPolicy";
import { VideoPromptDetectionService } from "@services/video-prompt-analysis/services/detection/VideoPromptDetectionService";
import type { ServiceConfig } from "./service-config.types.ts";

export function registerGenerationServices(container: DIContainer): void {
  container.register(
    "videoPromptDetector",
    () => new VideoPromptDetectionService(),
    [],
  );

  container.register(
    "videoToImageTransformer",
    (geminiClient: LLMClient | null) => {
      if (!geminiClient) {
        logger.warn(
          "Gemini client not available, video-to-image transformation disabled",
        );
        return null;
      }
      return new VideoToImagePromptTransformer({
        llmClient: geminiClient,
      });
    },
    ["geminiClient"],
  );

  container.register(
    "storyboardFramePlanner",
    (geminiClient: LLMClient | null, openAIClient: LLMClient | null) => {
      if (!geminiClient) {
        logger.warn(
          "Gemini client not available, storyboard frame planner disabled",
        );
        return null;
      }
      if (!openAIClient) {
        logger.warn(
          "OpenAI client not available, vision-based storyboard planning disabled (text-only fallback)",
        );
      }
      return new StoryboardFramePlanner({
        llmClient: geminiClient,
        visionLlmClient: openAIClient,
      });
    },
    ["geminiClient", "openAIClient"],
  );

  container.register(
    "replicateFluxSchnellProvider",
    (
      transformer: VideoToImagePromptTransformer | null,
      videoPromptDetector: VideoPromptDetectionService,
      config: ServiceConfig,
    ) => {
      const apiToken = config.replicate.apiToken;
      if (!apiToken) {
        logger.warn(
          "REPLICATE_API_TOKEN not provided, Replicate image provider disabled",
        );
        return null;
      }
      return new ReplicateFluxSchnellProvider({
        apiToken,
        promptTransformer: transformer,
        videoPromptDetector,
      });
    },
    ["videoToImageTransformer", "videoPromptDetector", "config"],
  );

  container.register(
    "replicateFluxKontextFastProvider",
    (
      transformer: VideoToImagePromptTransformer | null,
      videoPromptDetector: VideoPromptDetectionService,
      config: ServiceConfig,
    ) => {
      const apiToken = config.replicate.apiToken;
      if (!apiToken) {
        logger.warn(
          "REPLICATE_API_TOKEN not provided, Replicate image provider disabled",
        );
        return null;
      }
      return new ReplicateFluxKontextFastProvider({
        apiToken,
        promptTransformer: transformer,
        videoPromptDetector,
      });
    },
    ["videoToImageTransformer", "videoPromptDetector", "config"],
  );

  container.register(
    "imageGenerationService",
    (
      replicateProvider: ReplicateFluxSchnellProvider | null,
      kontextProvider: ReplicateFluxKontextFastProvider | null,
      imageAssetStore: ImageAssetStore,
      config: ServiceConfig,
    ) => {
      const providers = [replicateProvider, kontextProvider].filter(
        Boolean,
      ) as ImagePreviewProvider[];

      if (providers.length === 0) {
        logger.warn("No image preview providers configured");
        return null;
      }

      const vp = config.videoProviders;
      const selection = resolveImagePreviewProviderSelection(
        vp.imagePreviewProvider,
      );
      if (vp.imagePreviewProvider && !selection) {
        logger.warn("Invalid IMAGE_PREVIEW_PROVIDER value", {
          value: vp.imagePreviewProvider,
        });
      }

      const rawOrder = vp.imagePreviewProviderOrder.join(",") || undefined;
      const fallbackOrder = parseImagePreviewProviderOrder(rawOrder);
      if (
        vp.imagePreviewProviderOrder.length > 0 &&
        fallbackOrder.length === 0
      ) {
        logger.warn("No valid IMAGE_PREVIEW_PROVIDER_ORDER entries found", {
          value: vp.imagePreviewProviderOrder.join(","),
        });
      }

      return new ImageGenerationService({
        providers,
        assetStore: imageAssetStore,
        defaultProvider: selection ?? "auto",
        fallbackOrder,
      });
    },
    [
      "replicateFluxSchnellProvider",
      "replicateFluxKontextFastProvider",
      "imageAssetStore",
      "config",
    ],
  );

  container.register(
    "storyboardPreviewService",
    (
      imageGenerationService: ImageGenerationService | null,
      storyboardFramePlanner: StoryboardFramePlanner | null,
    ) => {
      if (!imageGenerationService || !storyboardFramePlanner) {
        logger.warn("Storyboard preview service disabled", {
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
    ["imageGenerationService", "storyboardFramePlanner"],
  );

  container.register(
    "videoGenerationService",
    (videoAssetStore: VideoAssetStore, config: ServiceConfig) => {
      setTimeoutPolicyConfig({
        pollTimeoutMs: config.videoProviders.pollTimeoutMs,
        workflowTimeoutMs: config.videoProviders.workflowTimeoutMs,
      });

      const creds = config.videoProviders.credentials;
      if (
        !creds.replicateApiToken &&
        !creds.openAIKey &&
        !creds.lumaApiKey &&
        !creds.klingApiKey &&
        !creds.geminiApiKey
      ) {
        logger.warn(
          "No video generation credentials provided (REPLICATE_API_TOKEN, OPENAI_API_KEY, LUMA_API_KEY or LUMAAI_API_KEY, KLING_API_KEY, or GEMINI_API_KEY)",
        );
        return null;
      }
      return new VideoGenerationService({
        assetStore: videoAssetStore,
        ...(creds.replicateApiToken
          ? { apiToken: creds.replicateApiToken }
          : {}),
        ...(creds.openAIKey ? { openAIKey: creds.openAIKey } : {}),
        ...(creds.lumaApiKey ? { lumaApiKey: creds.lumaApiKey } : {}),
        ...(creds.klingApiKey ? { klingApiKey: creds.klingApiKey } : {}),
        ...(creds.klingBaseUrl ? { klingBaseUrl: creds.klingBaseUrl } : {}),
        ...(creds.geminiApiKey ? { geminiApiKey: creds.geminiApiKey } : {}),
        ...(creds.geminiBaseUrl ? { geminiBaseUrl: creds.geminiBaseUrl } : {}),
      });
    },
    ["videoAssetStore", "config"],
  );

  container.register(
    "modelIntelligencePromptSpanProvider",
    (aiService: AIModelService): PromptSpanProvider => ({
      label: async (prompt: string) => {
        const result = await labelSpans({ text: prompt }, aiService);
        return Array.isArray(result.spans) ? result.spans : [];
      },
    }),
    ["aiService"],
  );

  container.register(
    "modelIntelligenceAvailabilityGate",
    (
      videoGenerationService: VideoGenerationService | null,
      creditService: UserCreditService,
      billingProfileStore: BillingProfileStore,
    ) =>
      new AvailabilityGateService(
        videoGenerationService,
        creditService,
        billingProfileStore,
      ),
    ["videoGenerationService", "userCreditService", "billingProfileStore"],
  );

  container.register(
    "modelIntelligenceService",
    (
      promptSpanProvider: PromptSpanProvider,
      availabilityGate: AvailabilityGateService,
      metricsService: MetricsService,
    ) =>
      new ModelIntelligenceService({
        promptSpanProvider,
        availabilityGate,
        metricsService,
      }),
    [
      "modelIntelligencePromptSpanProvider",
      "modelIntelligenceAvailabilityGate",
      "metricsService",
    ],
  );

  container.register(
    "keyframeGenerationService",
    (config: ServiceConfig) => {
      const falKey = config.fal.apiKey;
      if (!falKey) {
        logger.warn(
          "KeyframeGenerationService: FAL_KEY/FAL_API_KEY not set, service will be unavailable",
        );
        return null;
      }
      const replicateToken = config.replicate.apiToken;
      return new KeyframeGenerationService({
        falApiKey: falKey,
        ...(replicateToken ? { apiToken: replicateToken } : {}),
        enableFaceEmbedding: config.features.faceEmbedding,
      });
    },
    ["config"],
  );

  container.register(
    "faceSwapService",
    (config: ServiceConfig) => {
      const falKey = config.fal.apiKey;
      if (!falKey) {
        logger.warn(
          "FaceSwapService: FAL_KEY/FAL_API_KEY not set, service will be unavailable",
        );
        return null;
      }
      const faceSwapProvider = new FalFaceSwapProvider({ apiKey: falKey });
      if (!faceSwapProvider.isAvailable()) {
        logger.warn("FaceSwapService: Fal face swap provider unavailable");
        return null;
      }
      return new FaceSwapService({ faceSwapProvider });
    },
    ["config"],
  );

  container.register(
    "consistentVideoService",
    (
      videoGenerationService: VideoGenerationService | null,
      assetService: AssetService | null,
      keyframeGenerationService: KeyframeGenerationService | null,
    ) => {
      if (
        !videoGenerationService ||
        !assetService ||
        !keyframeGenerationService
      ) {
        logger.warn("Consistent video service disabled", {
          videoGenerationServiceAvailable: Boolean(videoGenerationService),
          assetServiceAvailable: Boolean(assetService),
          keyframeGenerationServiceAvailable: Boolean(
            keyframeGenerationService,
          ),
        });
        return null;
      }

      return new ConsistentVideoService({
        videoGenerationService,
        assetService,
        keyframeService: keyframeGenerationService,
      });
    },
    ["videoGenerationService", "assetService", "keyframeGenerationService"],
  );

  container.register(
    "capabilitiesProbeService",
    (config: ServiceConfig) =>
      new CapabilitiesProbeService(config.capabilities),
    ["config"],
  );

  container.register(
    "providerCircuitManager",
    (metricsService: MetricsService, config: ServiceConfig) => {
      const pc = config.videoJobs.providerCircuit;
      return new ProviderCircuitManager({
        failureRateThreshold: pc.failureRateThreshold,
        minVolume: pc.minVolume,
        cooldownMs: pc.cooldownMs,
        maxSamples: pc.maxSamples,
        metrics: metricsService,
      });
    },
    ["metricsService", "config"],
  );

  container.register(
    "videoWorkerHeartbeatStore",
    (firestoreCircuitExecutor: FirestoreCircuitExecutor) =>
      new VideoWorkerHeartbeatStore(firestoreCircuitExecutor),
    ["firestoreCircuitExecutor"],
  );

  container.register(
    "videoJobHandler",
    (
      videoJobStore: VideoJobStore,
      videoGenerationService: VideoGenerationService | null,
      creditService: UserCreditService,
      storageService: StorageService,
      metricsService: MetricsService,
      providerCircuitManager: ProviderCircuitManager,
      sessionService: SessionService,
    ) => {
      if (!videoGenerationService) {
        return null;
      }
      return new VideoJobHandler(
        videoJobStore,
        videoGenerationService,
        creditService,
        storageService,
        {
          providerCircuitManager,
          metrics: metricsService,
          // SessionService structurally satisfies JobSessionAppendPort; the
          // worker pipeline calls appendGenerationToVersion on successful
          // job completion so video generations are durable server-side.
          sessionService,
        },
      );
    },
    [
      "videoJobStore",
      "videoGenerationService",
      "userCreditService",
      "storageService",
      "metricsService",
      "providerCircuitManager",
      "sessionService",
    ],
  );

  container.register(
    "videoJobWorker",
    (
      videoJobStore: VideoJobStore,
      videoJobHandler: VideoJobHandler | null,
      metricsService: MetricsService,
      providerCircuitManager: ProviderCircuitManager,
      videoWorkerHeartbeatStore: VideoWorkerHeartbeatStore,
      config: ServiceConfig,
    ) => {
      if (!videoJobHandler) {
        return null;
      }

      const wc = config.videoJobs.worker;
      return new VideoJobWorker(videoJobStore, videoJobHandler, {
        pollIntervalMs: wc.pollIntervalMs,
        leaseMs: wc.leaseSeconds * 1000,
        maxConcurrent: wc.maxConcurrent,
        heartbeatIntervalMs: wc.heartbeatIntervalMs,
        processRole: "worker",
        ...(config.videoJobs.hostname
          ? { hostname: config.videoJobs.hostname }
          : {}),
        providerCircuitManager,
        workerHeartbeatStore: videoWorkerHeartbeatStore,
        ...(wc.perProviderMaxConcurrent !== undefined
          ? { perProviderMaxConcurrent: wc.perProviderMaxConcurrent }
          : {}),
        metrics: metricsService,
        providerIds: ["replicate", "openai", "luma", "kling", "gemini"],
      });
    },
    [
      "videoJobStore",
      "videoJobHandler",
      "metricsService",
      "providerCircuitManager",
      "videoWorkerHeartbeatStore",
      "config",
    ],
  );

  container.register(
    "videoJobSweeper",
    (
      videoJobStore: VideoJobStore,
      creditService: UserCreditService,
      metricsService: MetricsService,
      config: ServiceConfig,
    ) =>
      createVideoJobSweeper(
        videoJobStore,
        creditService,
        metricsService,
        config.videoJobs.sweeper,
      ),
    ["videoJobStore", "userCreditService", "metricsService", "config"],
  );

  container.register(
    "dlqReprocessorWorker",
    (
      videoJobStore: VideoJobStore,
      providerCircuitManager: ProviderCircuitManager,
      metricsService: MetricsService,
      config: ServiceConfig,
    ) => {
      const dlq = config.videoJobs.dlqReprocessor;
      if (dlq.disabled) {
        return null;
      }

      return new DlqReprocessorWorker(videoJobStore, {
        pollIntervalMs: dlq.pollIntervalMs,
        maxEntriesPerRun: dlq.maxEntriesPerRun,
        providerCircuitManager,
        metrics: metricsService,
      });
    },
    ["videoJobStore", "providerCircuitManager", "metricsService", "config"],
  );

  container.register(
    "videoJobReconciler",
    (
      gcsBucket: Bucket,
      videoJobStore: VideoJobStore,
      metricsService: MetricsService,
      config: ServiceConfig,
    ) =>
      createVideoJobReconciler(
        gcsBucket,
        config.videoAssets.storage.basePath,
        videoJobStore,
        metricsService,
        config.videoAssets.reconciler,
      ),
    ["gcsBucket", "videoJobStore", "metricsService", "config"],
  );
}
