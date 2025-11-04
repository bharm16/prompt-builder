import { Logger } from './Logger.js';
import { metricsService } from './MetricsService.js';
import { OpenAIAPIClient } from '../clients/OpenAIAPIClient.refactored.js';
import { CircuitBreakerFactory } from './CircuitBreakerAdapter.js';
import { openAILimiter } from '../utils/ConcurrencyLimiter.js';
import { CacheKeyGenerator } from '../services/cache/CacheKeyGenerator.js';
import { CacheStatisticsTracker } from '../services/cache/CacheStatisticsTracker.js';
import { NodeCacheAdapter } from '../services/cache/NodeCacheAdapter.js';
import { CacheServiceWithStatistics } from '../services/cache/CacheServiceWithStatistics.js';
import { SemanticCacheEnhancer } from '../utils/SemanticCacheEnhancer.js';
import { ModeRegistry } from '../services/prompt-optimization/modes/ModeRegistry.js';
import { ReasoningMode } from '../services/prompt-optimization/modes/ReasoningMode.js';
import { ContextInferenceService } from '../services/prompt-optimization/ContextInferenceService.js';
import { TwoStageOptimizationService } from '../services/prompt-optimization/TwoStageOptimizationService.js';
import { PromptOptimizationOrchestrator } from '../services/prompt-optimization/PromptOptimizationOrchestrator.js';

/**
 * Register all services in DI container
 * 
 * SOLID Principles Applied:
 * - DIP: All dependencies injected through constructor
 * - OCP: New services added without modifying existing ones
 */
export function registerRefactoredServices(container, config) {
  // Infrastructure
  container.register('logger', () => new Logger({
    level: config.logLevel || process.env.LOG_LEVEL || 'info',
  }));

  // Metrics (use existing singleton for compatibility)
  container.registerInstance('metricsService', metricsService);

  // Circuit breaker factory
  container.register('circuitBreakerFactory', (c) => new CircuitBreakerFactory({
    logger: c.resolve('logger'),
    metricsCollector: c.resolve('metricsService'),
    defaultConfig: {
      timeout: 60000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
    },
  }));

  // Concurrency limiter (use existing for compatibility)
  container.registerInstance('concurrencyLimiter', openAILimiter);

  // AI Clients
  container.register('openAIClient', (c) => new OpenAIAPIClient({
    apiKey: process.env.OPENAI_API_KEY,
    config: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      timeout: parseInt(process.env.OPENAI_TIMEOUT_MS) || 60000,
    },
    circuitBreaker: c.resolve('circuitBreakerFactory').create('openai-api'),
    concurrencyLimiter: c.resolve('concurrencyLimiter'),
    logger: c.resolve('logger'),
    metricsCollector: c.resolve('metricsService'),
  }));

  // Groq client (optional)
  if (process.env.GROQ_API_KEY) {
    // For now, use the existing GroqAPIClient
    // Can be refactored later to follow the same pattern
    const { GroqAPIClient } = require('../clients/GroqAPIClient.js');
    container.register('groqClient', () => new GroqAPIClient(
      process.env.GROQ_API_KEY,
      {
        timeout: parseInt(process.env.GROQ_TIMEOUT_MS) || 5000,
        model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      }
    ));
  }

  // Cache services
  container.register('semanticCacheEnhancer', () => new SemanticCacheEnhancer());

  container.register('cacheKeyGenerator', (c) => new CacheKeyGenerator({
    semanticEnhancer: c.resolve('semanticCacheEnhancer'),
  }));

  container.register('cacheStatisticsTracker', (c) => new CacheStatisticsTracker({
    metricsCollector: c.resolve('metricsService'),
  }));

  container.register('baseCacheService', (c) => new NodeCacheAdapter({
    config: {
      defaultTTL: 3600,
      checkperiod: 600,
    },
    keyGenerator: c.resolve('cacheKeyGenerator'),
    logger: c.resolve('logger'),
  }));

  container.register('cacheService', (c) => new CacheServiceWithStatistics({
    cacheService: c.resolve('baseCacheService'),
    statisticsTracker: c.resolve('cacheStatisticsTracker'),
  }));

  // Mode registry
  container.register('modeRegistry', (c) => {
    const registry = new ModeRegistry();
    const logger = c.resolve('logger');
    
    // Register modes
    registry.register(new ReasoningMode({ logger }));
    
    // Register other modes as they are created
    // registry.register(new ResearchMode({ logger }));
    // registry.register(new SocraticMode({ logger }));
    // registry.register(new VideoMode({ logger, videoPromptTemplates }));
    
    return registry;
  });

  // Prompt optimization services
  container.register('contextInferenceService', (c) => new ContextInferenceService({
    client: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
  }));

  container.register('twoStageOptimizationService', (c) => new TwoStageOptimizationService({
    draftClient: container.has('groqClient') ? c.resolve('groqClient') : null,
    refinementClient: c.resolve('openAIClient'),
    logger: c.resolve('logger'),
    spanLabeler: null, // Can add span labeler later
  }));

  container.register('promptOptimizationServiceRefactored', (c) => new PromptOptimizationOrchestrator({
    modeRegistry: c.resolve('modeRegistry'),
    contextInferenceService: c.resolve('contextInferenceService'),
    twoStageService: c.resolve('twoStageOptimizationService'),
    cacheService: c.resolve('cacheService'),
    logger: c.resolve('logger'),
  }));
}
