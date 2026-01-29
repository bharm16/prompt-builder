/**
 * Service Configuration and Registration
 *
 * This module defines all services and their dependencies.
 * Using dependency injection eliminates:
 * - Module-level mutable state
 * - Manual dependency wiring
 * - Tight coupling between services
 * - Testing difficulties
 */

import { createContainer, type DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { metricsService } from '@infrastructure/MetricsService';
import type { MetricsService as EnhancementMetricsService } from '@services/enhancement/services/types';

// Import generic LLM client
import { LLMClient } from '@clients/LLMClient';
import { OpenAICompatibleAdapter } from '@clients/adapters/OpenAICompatibleAdapter';
import { GroqLlamaAdapter } from '@clients/adapters/GroqLlamaAdapter';
import { GroqQwenAdapter } from '@clients/adapters/GroqQwenAdapter';
import { GeminiAdapter } from '@clients/adapters/GeminiAdapter';
import { openAILimiter, groqLimiter, qwenLimiter, geminiLimiter } from '@services/concurrency/ConcurrencyService';

// Import AI Model Service
import { AIModelService } from '@services/ai-model/index';

// Import services
import { cacheService } from '@services/cache/CacheService';
import { PromptOptimizationService } from '@services/prompt-optimization/PromptOptimizationService';
import { ImageObservationService } from '@services/image-observation';
import { EnhancementService } from '@services/EnhancementService';
import { SceneChangeDetectionService } from '@services/video-concept/services/detection/SceneChangeDetectionService';
import { PromptCoherenceService } from '@services/enhancement/services/PromptCoherenceService';
import { VideoConceptService } from '@services/VideoConceptService';
import { ModelIntelligenceService } from '@services/model-intelligence/ModelIntelligenceService';
import { initSpanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import { ReplicateFluxSchnellProvider } from '@services/image-generation/providers/ReplicateFluxSchnellProvider';
import { ReplicateFluxKontextFastProvider } from '@services/image-generation/providers/ReplicateFluxKontextFastProvider';
import { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import { VideoToImagePromptTransformer } from '@services/image-generation/providers/VideoToImagePromptTransformer';
import { StoryboardFramePlanner } from '@services/image-generation/storyboard/StoryboardFramePlanner';
import { StoryboardPreviewService } from '@services/image-generation/storyboard/StoryboardPreviewService';
import type { ImagePreviewProvider } from '@services/image-generation/providers/types';
import {
  parseImagePreviewProviderOrder,
  resolveImagePreviewProviderSelection,
} from '@services/image-generation/providers/registry';
import { createVideoAssetStore } from '@services/video-generation/storage';
import { createVideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import { createVideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { VideoJobWorker } from '@services/video-generation/jobs/VideoJobWorker';
import { createVideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import { userCreditService } from '@services/credits/UserCreditService';
import AssetService from '@services/asset/AssetService';
import ReferenceImageService from '@services/reference-images/ReferenceImageService';
import ConsistentVideoService from '@services/generation/ConsistentVideoService';
import KeyframeGenerationService from '@services/generation/KeyframeGenerationService';
import { CapabilitiesProbeService } from '@services/capabilities/CapabilitiesProbeService';
import { getStorageService } from '@services/storage/StorageService';
import { FaceEmbeddingService } from '@services/asset/FaceEmbeddingService';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import {
  AnchorService,
  CharacterKeyframeService,
  ContinuitySessionService,
  ContinuitySessionStore,
  FrameBridgeService,
  GradingService,
  ProviderStyleAdapter,
  QualityGateService,
  SceneProxyService,
  SeedPersistenceService,
  StyleAnalysisService,
  StyleReferenceService,
} from '@services/continuity';

// Import enhancement sub-services
import { PlaceholderDetectionService } from '@services/enhancement/services/PlaceholderDetectionService';
import { VideoPromptService } from '@services/video-prompt-analysis/index';
import { BrainstormContextBuilder } from '@services/enhancement/services/BrainstormContextBuilder';
import { CleanPromptBuilder } from '@services/enhancement/services/CleanPromptBuilder';
import { SuggestionValidationService } from '@services/enhancement/services/SuggestionValidationService';
import { SuggestionDiversityEnforcer } from '@services/enhancement/services/SuggestionDeduplicator';
import { CategoryAlignmentService } from '@services/enhancement/services/CategoryAlignmentService';

// Import config
import { createRedisClient } from './redis.ts';
import { resolveFalApiKey } from '@utils/falApiKey';


export interface ServiceConfig {
  openai: {
    apiKey: string | undefined;
    timeout: number;
    model: string;
  };
  groq: {
    apiKey: string | undefined;
    timeout: number;
    model: string;
  };
  qwen: {
    apiKey: string | undefined;
    timeout: number;
    model: string;
  };
  gemini: {
    apiKey: string | undefined;
    timeout: number;
    model: string;
    baseURL: string;
  };
  redis: {
    defaultTTL: number;
    shortTTL: number;
    maxMemoryCacheSize: number;
  };
  server: {
    port: string | number;
    environment: string | undefined;
  };
}

/**
 * Create and configure the dependency injection container
 * All service dependencies are declared explicitly
 *
 * @returns Configured container
 */
export async function configureServices(): Promise<DIContainer> {
  const container = createContainer();

  // ============================================================================
  // Infrastructure Services (no dependencies)
  // ============================================================================

  // Logger and metrics are singletons, register as values
  container.registerValue('logger', logger);
  container.registerValue('metricsService', metricsService);
  container.registerValue('cacheService', cacheService);
  container.registerValue('userCreditService', userCreditService);
  container.registerValue('billingProfileStore', new BillingProfileStore());
  container.register('storageService', () => getStorageService(), [], { singleton: true });
  container.register(
    'faceEmbeddingService',
    () => {
      const token = process.env.REPLICATE_API_TOKEN;
      if (!token) {
        logger.warn('FaceEmbeddingService disabled: REPLICATE_API_TOKEN not set');
        return null;
      }
      return new FaceEmbeddingService(undefined, token);
    },
    [],
    { singleton: true }
  );
  container.register('videoAssetStore', () => createVideoAssetStore(), [], { singleton: true });
  container.register('videoJobStore', () => new VideoJobStore(), [], { singleton: true });
  container.register('videoContentAccessService', () => createVideoContentAccessService(), [], { singleton: true });
  container.register(
    'videoAssetRetentionService',
    (videoAssetStore: ReturnType<typeof createVideoAssetStore>) =>
      createVideoAssetRetentionService(videoAssetStore),
    ['videoAssetStore'],
    { singleton: true }
  );

  // ============================================================================
  // Configuration Values
  // ============================================================================

  container.registerValue('config', {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      timeout: parseInt(process.env.OPENAI_TIMEOUT_MS || '60000', 10),
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      timeout: parseInt(process.env.GROQ_TIMEOUT_MS || '5000', 10),
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    },
    qwen: {
      apiKey: process.env.GROQ_API_KEY, // Uses same Groq API key
      timeout: parseInt(process.env.QWEN_TIMEOUT_MS || '10000', 10),
      model: process.env.QWEN_MODEL || 'qwen/qwen3-32b',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      timeout: parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10),
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      baseURL: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    },
    redis: {
      defaultTTL: 3600, // 1 hour
      shortTTL: 300,    // 5 minutes
      maxMemoryCacheSize: 100,
    },
    server: {
      port: process.env.PORT || 3001,
      environment: process.env.NODE_ENV || 'development',
    },
  } as ServiceConfig);

  // ============================================================================
  // API Clients
  // ============================================================================

  // OpenAI client (optional)
  // Using generic LLMClient configured for OpenAI
  container.register(
    'claudeClient',
    (config: ServiceConfig) => {
      if (!config.openai.apiKey) {
        logger.warn('OPENAI_API_KEY not provided, OpenAI adapter disabled');
        return null;
      }

      return new LLMClient({
        adapter: new OpenAICompatibleAdapter({
          apiKey: config.openai.apiKey,
          baseURL: 'https://api.openai.com/v1',
          defaultModel: config.openai.model,
          defaultTimeout: config.openai.timeout,
          providerName: 'openai',
        }),
        providerName: 'openai',
        defaultTimeout: config.openai.timeout,
        circuitBreakerConfig: {
          errorThresholdPercentage: 50,
          resetTimeout: 30000,
        },
        concurrencyLimiter: openAILimiter, // Limit concurrent requests
      });
    },
    ['config']
  );

  // Groq client (OPTIONAL - for two-stage optimization)
  // Using GroqLlamaAdapter optimized for Llama 3.x models
  // Implements Llama 3 PDF best practices:
  // - Temperature 0.1 (not 0.0 - avoids repetition loops)
  // - top_p 0.95 for strict instruction following
  // - Sandwich prompting for format adherence
  // - XML tagging for data segmentation
  // Factory returns null if not configured
  container.register(
    'groqClient',
    (config: ServiceConfig) => {
      if (!config.groq.apiKey) {
        logger.warn('GROQ_API_KEY not provided, two-stage optimization disabled');
        return null;
      }
      return new LLMClient({
        adapter: new GroqLlamaAdapter({
          apiKey: config.groq.apiKey,
          defaultModel: config.groq.model,
          defaultTimeout: config.groq.timeout,
        }),
        providerName: 'groq',
        defaultTimeout: config.groq.timeout,
        circuitBreakerConfig: {
          errorThresholdPercentage: 60, // More tolerant for fast provider
          resetTimeout: 15000, // Faster recovery
        },
        concurrencyLimiter: groqLimiter,
      });
    },
    ['config']
  );

  // Qwen client (OPTIONAL - higher quality suggestions via Qwen3 32B)
  // Uses GroqQwenAdapter optimized for Qwen3 models:
  // - reasoning_effort parameter for structured output
  // - Higher temperature tolerance (0.5 for diversity)
  // - No Llama-specific tricks needed
  container.register(
    'qwenClient',
    (config: ServiceConfig) => {
      if (!config.qwen.apiKey) {
        logger.warn('GROQ_API_KEY not provided, Qwen client disabled');
        return null;
      }
      return new LLMClient({
        adapter: new GroqQwenAdapter({
          apiKey: config.qwen.apiKey,
          defaultModel: config.qwen.model,
          defaultTimeout: config.qwen.timeout,
        }),
        providerName: 'qwen',
        defaultTimeout: config.qwen.timeout,
        circuitBreakerConfig: {
          errorThresholdPercentage: 60,
          resetTimeout: 15000,
        },
        concurrencyLimiter: qwenLimiter,
      });
    },
    ['config']
  );

  // Gemini client (OPTIONAL - fast/lightweight JSON-friendly option)
  container.register(
    'geminiClient',
    (config: ServiceConfig) => {
      if (!config.gemini.apiKey) {
        logger.warn('GEMINI_API_KEY not provided, Gemini adapter disabled');
        return null;
      }

      return new LLMClient({
        adapter: new GeminiAdapter({
          apiKey: config.gemini.apiKey,
          baseURL: config.gemini.baseURL,
          defaultModel: config.gemini.model,
          defaultTimeout: config.gemini.timeout,
          providerName: 'gemini',
        }),
        providerName: 'gemini',
        defaultTimeout: config.gemini.timeout,
        circuitBreakerConfig: {
          errorThresholdPercentage: 55,
          resetTimeout: 20000,
        },
        concurrencyLimiter: geminiLimiter,
      });
    },
    ['config']
  );

  // ============================================================================
  // AI Model Service (Router Layer)
  // ============================================================================

  // AIModelService - Unified router for all LLM operations
  // Decouples business logic from specific providers
  container.register(
    'aiService',
    (
      claudeClient: LLMClient | null,
      groqClient: LLMClient | null,
      qwenClient: LLMClient | null,
      geminiClient: LLMClient | null
    ) => new AIModelService({
      clients: {
        openai: claudeClient,
        groq: groqClient,
        qwen: qwenClient,
        gemini: geminiClient,
      },
    }),
    ['claudeClient', 'groqClient', 'qwenClient', 'geminiClient']
  );

  // ============================================================================
  // Redis and Caching
  // ============================================================================

  container.register(
    'redisClient',
    () => createRedisClient(),
    []
  );

  container.register(
    'spanLabelingCacheService',
    (redisClient: ReturnType<typeof createRedisClient>, config: ServiceConfig) => initSpanLabelingCache({
      redis: redisClient,
      defaultTTL: config.redis.defaultTTL,
      shortTTL: config.redis.shortTTL,
      maxMemoryCacheSize: config.redis.maxMemoryCacheSize,
    }),
    ['redisClient', 'config']
  );

  // ============================================================================
  // Enhancement Sub-Services (declared in dependency order)
  // ============================================================================

  container.register(
    'placeholderDetector',
    () => new PlaceholderDetectionService(),
    []
  );

  container.register(
    'videoService',
    () => new VideoPromptService(),
    []
  );

  container.register(
    'brainstormBuilder',
    () => new BrainstormContextBuilder(),
    []
  );

  container.register(
    'promptBuilder',
    () => new CleanPromptBuilder(),
    []
  );

  container.register(
    'validationService',
    (videoService: VideoPromptService) => new SuggestionValidationService(videoService),
    ['videoService']
  );

  container.register(
    'diversityEnforcer',
    (aiService: AIModelService) => new SuggestionDiversityEnforcer(aiService),
    ['aiService']
  );

  container.register(
    'categoryAligner',
    (validationService: SuggestionValidationService) => new CategoryAlignmentService(validationService),
    ['validationService']
  );

  // ============================================================================
  // Main Business Services
  // ============================================================================

  container.register(
    'promptOptimizationService',
    (
      aiService: AIModelService,
      videoService: VideoPromptService,
      imageObservationService: ImageObservationService
    ) =>
      new PromptOptimizationService(aiService, videoService, imageObservationService),
    ['aiService', 'videoService', 'imageObservationService']
  );

  container.register(
    'imageObservationService',
    (aiService: AIModelService) => new ImageObservationService(aiService),
    ['aiService']
  );

  container.register(
    'enhancementService',
    (
      aiService: AIModelService,
      placeholderDetector: PlaceholderDetectionService,
      videoService: VideoPromptService,
      brainstormBuilder: BrainstormContextBuilder,
      promptBuilder: CleanPromptBuilder,
      validationService: SuggestionValidationService,
      diversityEnforcer: SuggestionDiversityEnforcer,
      categoryAligner: CategoryAlignmentService,
      metrics: EnhancementMetricsService
    ) =>
      new EnhancementService({
        aiService,
        placeholderDetector,
        videoService,
        brainstormBuilder,
        promptBuilder,
        validationService,
        diversityEnforcer,
        categoryAligner,
        metricsService: metrics,
      }),
    [
      'aiService',
      'placeholderDetector',
      'videoService',
      'brainstormBuilder',
      'promptBuilder',
      'validationService',
      'diversityEnforcer',
      'categoryAligner',
      'metricsService',
    ]
  );

  container.register(
    'sceneDetectionService',
    (aiService: AIModelService) => new SceneChangeDetectionService(aiService),
    ['aiService']
  );

  container.register(
    'promptCoherenceService',
    (aiService: AIModelService) => new PromptCoherenceService(aiService),
    ['aiService']
  );

  container.register(
    'videoConceptService',
    (aiService: AIModelService) => new VideoConceptService(aiService),
    ['aiService']
  );

  // ============================================================================
  // Image Generation Service
  // ============================================================================

  // Video-to-image prompt transformer (uses Gemini for fast transformation)
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
    (geminiClient: LLMClient | null) => {
      if (!geminiClient) {
        logger.warn('Gemini client not available, storyboard frame planner disabled');
        return null;
      }
      return new StoryboardFramePlanner({
        llmClient: geminiClient,
        timeoutMs: 8000,
      });
    },
    ['geminiClient']
  );

  container.register(
    'replicateFluxSchnellProvider',
    (transformer: VideoToImagePromptTransformer | null) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        logger.warn('REPLICATE_API_TOKEN not provided, Replicate image provider disabled');
        return null;
      }
      return new ReplicateFluxSchnellProvider({ apiToken, promptTransformer: transformer });
    },
    ['videoToImageTransformer']
  );

  container.register(
    'replicateFluxKontextFastProvider',
    (transformer: VideoToImagePromptTransformer | null) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        logger.warn('REPLICATE_API_TOKEN not provided, Replicate image provider disabled');
        return null;
      }
      return new ReplicateFluxKontextFastProvider({
        apiToken,
        promptTransformer: transformer,
      });
    },
    ['videoToImageTransformer']
  );

  container.register(
    'imageGenerationService',
    (
      replicateProvider: ReplicateFluxSchnellProvider | null,
      kontextProvider: ReplicateFluxKontextFastProvider | null
    ) => {
      const providers = [replicateProvider, kontextProvider].filter(
        (provider): provider is ImagePreviewProvider => Boolean(provider)
      );

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
        defaultProvider: selection ?? 'auto',
        fallbackOrder,
      });
    },
    ['replicateFluxSchnellProvider', 'replicateFluxKontextFastProvider']
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
    (videoAssetStore: ReturnType<typeof createVideoAssetStore>) => {
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
      creditService: typeof userCreditService,
      billingProfileStore: BillingProfileStore
    ) =>
      new ModelIntelligenceService({
        aiService,
        videoGenerationService,
        userCreditService: creditService,
        billingProfileStore,
      }),
    ['aiService', 'videoGenerationService', 'userCreditService', 'billingProfileStore'],
    { singleton: true }
  );

  container.register(
    'assetService',
    () => {
      try {
        return new AssetService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Asset service disabled', { error: errorMessage });
        return null;
      }
    },
    [],
    { singleton: true }
  );

  container.register(
    'referenceImageService',
    () => {
      try {
        return new ReferenceImageService();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.warn('Reference image service disabled', { error: errorMessage });
        return null;
      }
    },
    [],
    { singleton: true }
  );

  container.register(
    'keyframeGenerationService',
    () => {
      const falKey = resolveFalApiKey();
      if (!falKey) {
        logger.warn('KeyframeGenerationService: FAL_KEY/FAL_API_KEY not set, service will be unavailable');
        return null;
      }
      const replicateToken = process.env.REPLICATE_API_TOKEN;
      return new KeyframeGenerationService({
        falApiKey: falKey,
        ...(replicateToken ? { apiToken: replicateToken } : {}),
      });
    },
    [],
    { singleton: true }
  );

  container.register(
    'keyframeService',
    () => {
      const falKey = resolveFalApiKey();
      if (!falKey) {
        logger.warn('KeyframeGenerationService: FAL_KEY/FAL_API_KEY not set, service will be unavailable');
        return null;
      }
      const replicateToken = process.env.REPLICATE_API_TOKEN;
      return new KeyframeGenerationService({
        falApiKey: falKey,
        ...(replicateToken ? { apiToken: replicateToken } : {}),
      });
    },
    [],
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

      return new ContinuitySessionService(
        anchorService,
        frameBridgeService,
        styleReferenceService,
        characterKeyframeService,
        providerStyleAdapter,
        seedPersistenceService,
        styleAnalysisService,
        gradingService,
        qualityGateService,
        sceneProxyService,
        videoGenerationService,
        assetService,
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

  container.register(
    'capabilitiesProbeService',
    () => new CapabilitiesProbeService(),
    [],
    { singleton: true }
  );

  container.register(
    'videoJobWorker',
    (
      videoJobStore: VideoJobStore,
      videoGenerationService: VideoGenerationService | null,
      creditService: typeof userCreditService
    ) => {
      if (!videoGenerationService) {
        return null;
      }

      const pollIntervalMs = Number.parseInt(process.env.VIDEO_JOB_POLL_INTERVAL_MS || '2000', 10);
      const leaseSeconds = Number.parseInt(process.env.VIDEO_JOB_LEASE_SECONDS || '900', 10);
      const maxConcurrent = Number.parseInt(process.env.VIDEO_JOB_MAX_CONCURRENT || '2', 10);

      return new VideoJobWorker(videoJobStore, videoGenerationService, creditService, {
        pollIntervalMs: Number.isFinite(pollIntervalMs) ? pollIntervalMs : 2000,
        leaseMs: Number.isFinite(leaseSeconds) ? leaseSeconds * 1000 : 900000,
        maxConcurrent: Number.isFinite(maxConcurrent) ? maxConcurrent : 2,
      });
    },
    ['videoJobStore', 'videoGenerationService', 'userCreditService']
  );

  container.register(
    'videoJobSweeper',
    (videoJobStore: VideoJobStore, creditService: typeof userCreditService) =>
      createVideoJobSweeper(videoJobStore, creditService),
    ['videoJobStore', 'userCreditService'],
    { singleton: true }
  );

  return container;
}

export { initializeServices } from './services.initialize';
