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

// Import clients
import { OpenAIAPIClient } from '../clients/OpenAIAPIClient.js';
import { GroqAPIClient } from '../clients/GroqAPIClient.js';

// Import services
import { cacheService } from '../services/CacheService.js';
import { PromptOptimizationService } from '../services/PromptOptimizationService.js';
import { QuestionGenerationService } from '../services/QuestionGenerationService.js';
import { EnhancementService } from '../services/EnhancementService.js';
import { SceneDetectionService } from '../services/SceneDetectionService.js';
import { VideoConceptService } from '../services/VideoConceptService.js';
import { TextCategorizerService } from '../services/TextCategorizerService.js';
import { initSpanLabelingCache } from '../services/SpanLabelingCacheService.js';

// Import enhancement sub-services
import { PlaceholderDetectionService } from '../services/enhancement/PlaceholderDetectionService.js';
import { VideoPromptService } from '../services/enhancement/VideoPromptService.js';
import { BrainstormContextBuilder } from '../services/enhancement/BrainstormContextBuilder.js';
import { PromptBuilderService } from '../services/enhancement/PromptBuilderService.js';
import { SuggestionValidationService } from '../services/enhancement/SuggestionValidationService.js';
import { SuggestionDiversityEnforcer } from '../services/enhancement/SuggestionDiversityEnforcer.js';
import { CategoryAlignmentService } from '../services/enhancement/CategoryAlignmentService.js';

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
  container.register(
    'claudeClient',
    (config) => new OpenAIAPIClient(config.openai.apiKey, {
      timeout: config.openai.timeout,
      model: config.openai.model,
    }),
    ['config']
  );

  // Groq client (OPTIONAL - for two-stage optimization)
  // Factory returns null if not configured
  container.register(
    'groqClient',
    (config) => {
      if (!config.groq.apiKey) {
        logger.warn('GROQ_API_KEY not provided, two-stage optimization disabled');
        return null;
      }
      return new GroqAPIClient(config.groq.apiKey, {
        timeout: config.groq.timeout,
        model: config.groq.model,
      });
    },
    ['config']
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
    (brainstormBuilder, videoService) =>
      new PromptBuilderService(brainstormBuilder, videoService),
    ['brainstormBuilder', 'videoService']
  );

  container.register(
    'validationService',
    (videoService) => new SuggestionValidationService(videoService),
    ['videoService']
  );

  container.register(
    'diversityEnforcer',
    (claudeClient) => new SuggestionDiversityEnforcer(claudeClient),
    ['claudeClient']
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
    (claudeClient, groqClient) =>
      new PromptOptimizationService(claudeClient, groqClient),
    ['claudeClient', 'groqClient']
  );

  container.register(
    'questionGenerationService',
    (claudeClient) => new QuestionGenerationService(claudeClient),
    ['claudeClient']
  );

  container.register(
    'enhancementService',
    (
      claudeClient,
      groqClient,
      placeholderDetector,
      videoService,
      brainstormBuilder,
      promptBuilder,
      validationService,
      diversityEnforcer,
      categoryAligner
    ) =>
      new EnhancementService(
        claudeClient,
        groqClient,
        placeholderDetector,
        videoService,
        brainstormBuilder,
        promptBuilder,
        validationService,
        diversityEnforcer,
        categoryAligner
      ),
    [
      'claudeClient',
      'groqClient',
      'placeholderDetector',
      'videoService',
      'brainstormBuilder',
      'promptBuilder',
      'validationService',
      'diversityEnforcer',
      'categoryAligner',
    ]
  );

  container.register(
    'sceneDetectionService',
    (claudeClient) => new SceneDetectionService(claudeClient),
    ['claudeClient']
  );

  container.register(
    'videoConceptService',
    (claudeClient) => new VideoConceptService(claudeClient),
    ['claudeClient']
  );

  container.register(
    'textCategorizerService',
    (claudeClient) => new TextCategorizerService(claudeClient),
    ['claudeClient']
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

  // Pre-resolve all services to ensure they can be instantiated
  // This catches configuration errors early
  const serviceNames = [
    'promptOptimizationService',
    'questionGenerationService',
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
