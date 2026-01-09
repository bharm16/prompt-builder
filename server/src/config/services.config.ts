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
import { EnhancementService } from '@services/EnhancementService';
import { SceneChangeDetectionService } from '@services/video-concept/services/detection/SceneChangeDetectionService';
import { VideoConceptService } from '@services/VideoConceptService';
import { initSpanLabelingCache } from '@services/cache/SpanLabelingCacheService';
import { ImageGenerationService } from '@services/image-generation/ImageGenerationService';
import { VideoGenerationService } from '@services/video-generation/VideoGenerationService';
import { VideoToImagePromptTransformer } from '@services/image-generation/VideoToImagePromptTransformer';
import { createVideoAssetStore } from '@services/video-generation/storage';
import { createVideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';
import { createVideoContentAccessService } from '@services/video-generation/access/VideoContentAccessService';
import { VideoJobStore } from '@services/video-generation/jobs/VideoJobStore';
import { VideoJobWorker } from '@services/video-generation/jobs/VideoJobWorker';
import { createVideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import { userCreditService } from '@services/credits/UserCreditService';
import type { VideoJobSweeper } from '@services/video-generation/jobs/VideoJobSweeper';
import type { VideoAssetRetentionService } from '@services/video-generation/storage/VideoAssetRetentionService';

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

// Import NLP warmup
import { warmupGliner } from '@llm/span-labeling/nlp/NlpSpanService';

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
    (aiService: AIModelService, videoService: VideoPromptService) =>
      new PromptOptimizationService(aiService, videoService),
    ['aiService', 'videoService']
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
      new EnhancementService(
        aiService,
        placeholderDetector,
        videoService,
        brainstormBuilder,
        promptBuilder,
        validationService,
        diversityEnforcer,
        categoryAligner,
        metrics
      ),
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
    'imageGenerationService',
    (transformer: VideoToImagePromptTransformer | null) => {
      const apiToken = process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        logger.warn('REPLICATE_API_TOKEN not provided, image generation disabled');
        return null;
      }
      return new ImageGenerationService({ apiToken }, transformer);
    },
    ['videoToImageTransformer']
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

interface HealthCheckResult {
  healthy: boolean;
  error?: string;
  responseTime?: number;
}

/**
 * Initialize and validate all services
 * Performs health checks on critical services
 *
 * @throws {Error} If critical services fail health checks
 */
export async function initializeServices(container: DIContainer): Promise<DIContainer> {
  logger.info('Initializing services...');

  // Resolve OpenAI client and validate (optional)
  const claudeClient = container.resolve<LLMClient | null>('claudeClient');

  if (claudeClient) {
    logger.info('Validating OpenAI API key...');

    try {
      const openAIHealth = await claudeClient.healthCheck() as HealthCheckResult;

      if (!openAIHealth.healthy) {
        logger.warn(
          '⚠️  OpenAI API key validation failed - OpenAI adapter disabled',
          { error: openAIHealth.error }
        );
        container.registerValue('claudeClient', null);
      } else {
        logger.info('✅ OpenAI API key validated successfully', {
          responseTime: openAIHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate OpenAI API key - OpenAI adapter disabled',
        { error: errorMessage }
      );
      container.registerValue('claudeClient', null);
    }
  } else {
    logger.warn('OpenAI client not configured; relying on other providers');
  }

  // Resolve and validate Groq client (OPTIONAL)
  const groqClient = container.resolve<LLMClient | null>('groqClient');
  if (groqClient) {
    logger.info('Groq client initialized for two-stage optimization');

    try {
      const groqHealth = await groqClient.healthCheck() as HealthCheckResult;

      if (!groqHealth.healthy) {
        logger.warn(
          '⚠️  Groq API key validation failed - two-stage optimization disabled',
          {
            error: groqHealth.error,
          }
        );
        // Override with null to disable
        container.registerValue('groqClient', null);
      } else {
        logger.info('✅ Groq API key validated successfully', {
          responseTime: groqHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Groq API key - two-stage optimization disabled',
        {
          error: errorMessage,
        }
      );
      container.registerValue('groqClient', null);
    }
  }

  // Resolve and validate Qwen client (OPTIONAL)
  const qwenClient = container.resolve<LLMClient | null>('qwenClient');
  if (qwenClient) {
    logger.info('Qwen client initialized for adapter-based routing');

    try {
      const qwenHealth = await qwenClient.healthCheck() as HealthCheckResult;

      if (!qwenHealth.healthy) {
        logger.warn(
          '⚠️  Qwen API key validation failed - adapter disabled',
          {
            error: qwenHealth.error,
          }
        );
        container.registerValue('qwenClient', null);
      } else {
        logger.info('✅ Qwen API key validated successfully', {
          responseTime: qwenHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Qwen API key - adapter disabled',
        {
          error: errorMessage,
        }
      );
      container.registerValue('qwenClient', null);
    }
  }

  // Resolve and validate Gemini client (OPTIONAL)
  const geminiClient = container.resolve<LLMClient | null>('geminiClient');
  if (geminiClient) {
    logger.info('Gemini client initialized for adapter-based routing');
    const allowUnhealthyGemini = process.env.GEMINI_ALLOW_UNHEALTHY === 'true';

    try {
      const geminiHealth = await geminiClient.healthCheck() as HealthCheckResult;

      if (!geminiHealth.healthy) {
        logger.warn(
          '⚠️  Gemini API key validation failed',
          {
            error: geminiHealth.error,
          }
        );
        if (!allowUnhealthyGemini) {
          logger.warn('⚠️  Gemini adapter disabled (health check failed)');
          container.registerValue('geminiClient', null);
        } else {
          logger.warn('Keeping Gemini adapter enabled despite failed health check');
        }
      } else {
        logger.info('✅ Gemini API key validated successfully', {
          responseTime: geminiHealth.responseTime,
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.warn(
        '⚠️  Failed to validate Gemini API key',
        {
          error: errorMessage,
        }
      );
      if (!allowUnhealthyGemini) {
        logger.warn('⚠️  Gemini adapter disabled (health check failed)');
        container.registerValue('geminiClient', null);
      } else {
        logger.warn('Keeping Gemini adapter enabled despite failed health check');
      }
    }
  }

  // Pre-resolve all services to ensure they can be instantiated
  // This catches configuration errors early
  const serviceNames = [
    'promptOptimizationService',
    'enhancementService',
    'sceneDetectionService',
    'videoConceptService',
    'spanLabelingCacheService',
  ];

  for (const serviceName of serviceNames) {
    try {
      container.resolve(serviceName);
      logger.info(`✅ ${serviceName} initialized`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`❌ Failed to initialize ${serviceName}`, error instanceof Error ? error : new Error(String(error)));
      throw new Error(`Service initialization failed for ${serviceName}: ${errorMessage}`);
    }
  }

  logger.info('All services initialized and validated successfully');
  const promptOutputOnly = process.env.PROMPT_OUTPUT_ONLY === 'true';
  const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.VITEST_WORKER_ID;
  
  // Only warmup GLiNER if neuro-symbolic pipeline is enabled and prewarm is requested
  const { NEURO_SYMBOLIC } = await import('@llm/span-labeling/config/SpanLabelingConfig');
  const shouldWarmGliner = !promptOutputOnly &&
    NEURO_SYMBOLIC.ENABLED &&
    NEURO_SYMBOLIC.GLINER?.ENABLED &&
    NEURO_SYMBOLIC.GLINER.PREWARM_ON_STARTUP;
  if (shouldWarmGliner) {
    try {
      const glinerResult = await warmupGliner();
      if (glinerResult.success) {
        logger.info('✅ GLiNER model warmed up for semantic extraction');
      } else {
        logger.warn('⚠️ GLiNER warmup skipped: ' + (glinerResult.message || 'Unknown reason'));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn('⚠️ GLiNER warmup failed', { error: errorMessage });
    }
  } else {
    const reason = promptOutputOnly ? 'PROMPT_OUTPUT_ONLY' : 'prewarm disabled or GLiNER disabled';
    logger.info(`ℹ️ GLiNER warmup skipped (${reason})`);
  }

  if (!isTestEnv && !promptOutputOnly) {
    const videoAssetRetentionService =
      container.resolve<VideoAssetRetentionService | null>('videoAssetRetentionService');
    if (videoAssetRetentionService) {
      videoAssetRetentionService.start();
      logger.info('✅ Video asset retention service started');
    }

    const videoJobSweeper = container.resolve<VideoJobSweeper | null>('videoJobSweeper');
    if (videoJobSweeper) {
      videoJobSweeper.start();
      logger.info('✅ Video job sweeper started');
    }

    const videoJobWorker = container.resolve<VideoJobWorker | null>('videoJobWorker');
    const workerDisabled = process.env.VIDEO_JOB_WORKER_DISABLED === 'true';
    if (videoJobWorker && !workerDisabled) {
      videoJobWorker.start();
      logger.info('✅ Video job worker started');
    } else if (videoJobWorker && workerDisabled) {
      logger.warn('Video job worker disabled via VIDEO_JOB_WORKER_DISABLED');
    }
  } else if (promptOutputOnly) {
    logger.info('ℹ️ Video background services skipped (PROMPT_OUTPUT_ONLY)');
  }

  return container;
}
