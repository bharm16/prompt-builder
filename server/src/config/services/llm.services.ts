import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { LLMClient } from '@clients/LLMClient';
import { GeminiAdapter } from '@clients/adapters/GeminiAdapter';
import { GroqLlamaAdapter } from '@clients/adapters/GroqLlamaAdapter';
import { GroqQwenAdapter } from '@clients/adapters/GroqQwenAdapter';
import { OpenAICompatibleAdapter } from '@clients/adapters/OpenAICompatibleAdapter';
import { AIModelService } from '@services/ai-model/index';
import { setProviderSettings } from '@services/ai-model/routing/ExecutionPlan';
import { ConcurrencyLimiter, parseEnvInt } from '@services/concurrency/ConcurrencyService';
import type { MetricsService } from '@infrastructure/MetricsService';
import type { ServiceConfig } from './service-config.types.ts';

export function registerLLMServices(container: DIContainer): void {
  // Register concurrency limiters with metrics injection
  const defaultMaxConcurrent = process.env.NODE_ENV === 'production' ? 10 : 5;

  container.register(
    'openAILimiter',
    (metricsService: MetricsService) => new ConcurrencyLimiter({
      maxConcurrent: parseEnvInt(process.env.OPENAI_MAX_CONCURRENT, defaultMaxConcurrent),
      queueTimeout: parseEnvInt(process.env.OPENAI_QUEUE_TIMEOUT_MS, 30000),
      enableCancellation: true,
      metricsService,
    }),
    ['metricsService']
  );

  container.register(
    'groqLimiter',
    (metricsService: MetricsService) => new ConcurrencyLimiter({
      maxConcurrent: parseEnvInt(process.env.GROQ_MAX_CONCURRENT, defaultMaxConcurrent),
      queueTimeout: parseEnvInt(process.env.GROQ_QUEUE_TIMEOUT_MS, 30000),
      enableCancellation: true,
      metricsService,
    }),
    ['metricsService']
  );

  // Qwen shares the Groq API key; use the same limiter to respect shared limits.
  container.register('qwenLimiter', (groqLimiter: ConcurrencyLimiter) => groqLimiter, ['groqLimiter']);

  container.register(
    'geminiLimiter',
    (metricsService: MetricsService) => new ConcurrencyLimiter({
      maxConcurrent: parseEnvInt(process.env.GEMINI_MAX_CONCURRENT, defaultMaxConcurrent),
      queueTimeout: parseEnvInt(process.env.GEMINI_QUEUE_TIMEOUT_MS, 30000),
      enableCancellation: true,
      metricsService,
    }),
    ['metricsService']
  );

  container.register(
    'claudeClient',
    (config: ServiceConfig, openAILimiter: ConcurrencyLimiter, metricsService: MetricsService) => {
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
        concurrencyLimiter: openAILimiter,
        metricsService,
      });
    },
    ['config', 'openAILimiter', 'metricsService']
  );

  container.register(
    'groqClient',
    (config: ServiceConfig, groqLimiter: ConcurrencyLimiter, metricsService: MetricsService) => {
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
          errorThresholdPercentage: 60,
          resetTimeout: 15000,
        },
        concurrencyLimiter: groqLimiter,
        metricsService,
      });
    },
    ['config', 'groqLimiter', 'metricsService']
  );

  container.register(
    'qwenClient',
    (config: ServiceConfig, qwenLimiter: ConcurrencyLimiter, metricsService: MetricsService) => {
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
        metricsService,
      });
    },
    ['config', 'qwenLimiter', 'metricsService']
  );

  container.register(
    'geminiClient',
    (config: ServiceConfig, geminiLimiter: ConcurrencyLimiter, metricsService: MetricsService) => {
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
        metricsService,
      });
    },
    ['config', 'geminiLimiter', 'metricsService']
  );

  container.register(
    'aiService',
    (
      claudeClient: LLMClient | null,
      groqClient: LLMClient | null,
      qwenClient: LLMClient | null,
      geminiClient: LLMClient | null,
      config: ServiceConfig,
      metricsService: MetricsService
    ) => {
      setProviderSettings({
        openai: { model: config.openai.model, timeout: config.openai.timeout },
        groq: { model: config.groq.model, timeout: config.groq.timeout },
        qwen: { model: config.qwen.model, timeout: config.qwen.timeout },
        gemini: { model: config.gemini.model, timeout: config.gemini.timeout },
      });

      return new AIModelService({
        clients: {
          openai: claudeClient,
          groq: groqClient,
          qwen: qwenClient,
          gemini: geminiClient,
        },
        metrics: metricsService,
      });
    },
    ['claudeClient', 'groqClient', 'qwenClient', 'geminiClient', 'config', 'metricsService']
  );
}
