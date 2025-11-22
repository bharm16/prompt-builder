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

import { createContainer } from '../infrastructure/DIContainer.js';
import { logger } from '../infrastructure/Logger.js';
import { metricsService } from '../infrastructure/MetricsService.js';

// Import generic LLM client
import { LLMClient } from '../clients/LLMClient.js';
import { OpenAICompatibleAdapter } from '../clients/adapters/OpenAICompatibleAdapter.js';
import { GeminiAdapter } from '../clients/adapters/GeminiAdapter.js';
import { openAILimiter } from '../services/concurrency/ConcurrencyService.js';

// Import AI Model Service
import { AIModelService } from '../services/ai-model/index.js';

// Import services
import { cacheService } from '../services/cache/CacheService.js';
import { PromptOptimizationService } from '../services/prompt-optimization/PromptOptimizationService.js';
import { EnhancementService } from '../services/EnhancementService.js';
import { SceneChangeDetectionService } from '../services/video-concept/services/detection/SceneChangeDetectionService.js';
import { VideoConceptService } from '../services/VideoConceptService.js';
import { TextCategorizerService } from '../services/text-categorization/TextCategorizerService.js';
import { initSpanLabelingCache } from '../services/cache/SpanLabelingCacheService.js';

// Import enhancement sub-services
import { PlaceholderDetectionService } from '../services/enhancement/services/PlaceholderDetectionService.js';
import { VideoPromptService } from '../services/video-prompt-analysis/index.js';
import { BrainstormContextBuilder } from '../services/enhancement/services/BrainstormContextBuilder.js';
import { CleanPromptBuilder } from '../services/enhancement/services/CleanPromptBuilder.js';
import { SuggestionValidationService } from '../services/enhancement/services/SuggestionValidationService.js';
import { SuggestionDiversityEnforcer } from '../services/enhancement/services/SuggestionDeduplicator.js';
import { CategoryAlignmentService } from '../services/enhancement/services/CategoryAlignmentService.js';

// Import config
import { createRedisClient } from './redis.js';

/**
 * Create and configure the dependency injection container
 * All service dependencies are declared explicitly
 *
 * @returns {DIContainer} Configured container
 */
export function configureServices() {
  const container = createContainer();

  // ============================================================================
  // Infrastructure Services (no dependencies)
  // ============================================================================

  // Logger and metrics are singletons, register as values
  container.registerValue('logger', logger);
  container.registerValue('metricsService', metricsService);
  container.registerValue('cacheService', cacheService);

  // ============================================================================
  // Configuration Values
  // ============================================================================

  container.registerValue('config', {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      timeout: parseInt(process.env.OPENAI_TIMEOUT_MS) || 60000,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY,
      timeout: parseInt(process.env.GROQ_TIMEOUT_MS) || 5000,
      model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY,
      timeout: parseInt(process.env.GEMINI_TIMEOUT_MS) || 30000,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
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
  });

  // ============================================================================
  // API Clients
  // ============================================================================

  // OpenAI client (CRITICAL - required)
  // Using generic LLMClient configured for OpenAI
  container.register(
    'claudeClient',
    (config) => new LLMClient({
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
    }),
    ['config']
  );

  // Groq client (OPTIONAL - for two-stage optimization)
  // Using generic LLMClient configured for Groq
  // Factory returns null if not configured
  container.register(
    'groqClient',
    (config) => {
      if (!config.groq.apiKey) {
        logger.warn('GROQ_API_KEY not provided, two-stage optimization disabled');
        return null;
      }
      return new LLMClient({
        adapter: new OpenAICompatibleAdapter({
          apiKey: config.groq.apiKey,
          baseURL: 'https://api.groq.com/openai/v1',
          defaultModel: config.groq.model,
          defaultTimeout: config.groq.timeout,
          providerName: 'groq',
        }),
        providerName: 'groq',
        defaultTimeout: config.groq.timeout,
        circuitBreakerConfig: {
          errorThresholdPercentage: 60, // More tolerant for fast provider
          resetTimeout: 15000, // Faster recovery
        },
        concurrencyLimiter: null, // No concurrency limiting for Groq
      });
    },
    ['config']
  );

  // Gemini client (OPTIONAL - fast/lightweight JSON-friendly option)
  container.register(
    'geminiClient',
    (config) => {
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
        concurrencyLimiter: null,
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
    (claudeClient, groqClient, geminiClient) => new AIModelService({
      clients: {
        openai: claudeClient,
        groq: groqClient,
        gemini: geminiClient,
      },
    }),
    ['claudeClient', 'groqClient', 'geminiClient']
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
    (redisClient, config) => initSpanLabelingCache({
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
    (videoService) => new SuggestionValidationService(videoService),
    ['videoService']
  );

  container.register(
    'diversityEnforcer',
    (aiService) => new SuggestionDiversityEnforcer(aiService),
    ['aiService']
  );

  container.register(
    'categoryAligner',
    (validationService) => new CategoryAlignmentService(validationService),
    ['validationService']
  );

  // ============================================================================
  // Main Business Services
  // ============================================================================

  container.register(
    'promptOptimizationService',
    (aiService) =>
      new PromptOptimizationService(aiService),
    ['aiService']
  );

  container.register(
    'enhancementService',
    (
      aiService,
      placeholderDetector,
      videoService,
      brainstormBuilder,
      promptBuilder,
      validationService,
      diversityEnforcer,
      categoryAligner,
      metricsService
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
        metricsService
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
    (aiService) => new SceneChangeDetectionService(aiService),
    ['aiService']
  );

  container.register(
    'videoConceptService',
    (aiService) => new VideoConceptService(aiService),
    ['aiService']
  );

  container.register(
    'textCategorizerService',
    (aiService) => new TextCategorizerService(aiService),
    ['aiService']
  );

  return container;
}

/**
 * Initialize and validate all services
 * Performs health checks on critical services
 *
 * @param {DIContainer} container - The DI container
 * @throws {Error} If critical services fail health checks
 */
export async function initializeServices(container) {
  logger.info('Initializing services...');

  // Resolve OpenAI client and validate (CRITICAL)
  const claudeClient = container.resolve('claudeClient');
  logger.info('Validating OpenAI API key...');

  const openAIHealth = await claudeClient.healthCheck();

  if (!openAIHealth.healthy) {
    logger.error('❌ OpenAI API key validation failed', {
      error: openAIHealth.error,
    });
    console.error('\n❌ FATAL: OpenAI API key validation failed');
    console.error('The application cannot function without a valid OpenAI API key');
    console.error('Please check your OPENAI_API_KEY in .env file\n');
    throw new Error(`OpenAI API validation failed: ${openAIHealth.error}`);
  }

  logger.info('✅ OpenAI API key validated successfully', {
    responseTime: openAIHealth.responseTime,
  });

  // Resolve and validate Groq client (OPTIONAL)
  const groqClient = container.resolve('groqClient');
  if (groqClient) {
    logger.info('Groq client initialized for two-stage optimization');

    try {
      const groqHealth = await groqClient.healthCheck();

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
      logger.warn(
        '⚠️  Failed to validate Groq API key - two-stage optimization disabled',
        {
          error: err.message,
        }
      );
      container.registerValue('groqClient', null);
    }
  }

  // Resolve and validate Gemini client (OPTIONAL)
  const geminiClient = container.resolve('geminiClient');
  if (geminiClient) {
    logger.info('Gemini client initialized for adapter-based routing');

    try {
      const geminiHealth = await geminiClient.healthCheck();

      if (!geminiHealth.healthy) {
        logger.warn(
          '⚠️  Gemini API key validation failed - adapter disabled',
          {
            error: geminiHealth.error,
          }
        );
        container.registerValue('geminiClient', null);
      } else {
        logger.info('✅ Gemini API key validated successfully', {
          responseTime: geminiHealth.responseTime,
        });
      }
    } catch (err) {
      logger.warn(
        '⚠️  Failed to validate Gemini API key - adapter disabled',
        {
          error: err.message,
        }
      );
      container.registerValue('geminiClient', null);
    }
  }

  // Pre-resolve all services to ensure they can be instantiated
  // This catches configuration errors early
  const serviceNames = [
    'promptOptimizationService',
    'enhancementService',
    'sceneDetectionService',
    'videoConceptService',
    'textCategorizerService',
    'spanLabelingCacheService',
  ];

  for (const serviceName of serviceNames) {
    try {
      container.resolve(serviceName);
      logger.info(`✅ ${serviceName} initialized`);
    } catch (error) {
      logger.error(`❌ Failed to initialize ${serviceName}`, error);
      throw new Error(`Service initialization failed for ${serviceName}: ${error.message}`);
    }
  }

  logger.info('All services initialized and validated successfully');
  return container;
}
