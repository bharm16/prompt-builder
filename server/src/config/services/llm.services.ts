import type { DIContainer } from '@infrastructure/DIContainer';
import { logger } from '@infrastructure/Logger';
import { LLMClient } from '@clients/LLMClient';
import { GeminiAdapter } from '@clients/adapters/GeminiAdapter';
import { GroqLlamaAdapter } from '@clients/adapters/GroqLlamaAdapter';
import { GroqQwenAdapter } from '@clients/adapters/GroqQwenAdapter';
import { OpenAICompatibleAdapter } from '@clients/adapters/OpenAICompatibleAdapter';
import { AIModelService } from '@services/ai-model/index';
import {
  geminiLimiter,
  groqLimiter,
  openAILimiter,
  qwenLimiter,
} from '@services/concurrency/ConcurrencyService';
import type { ServiceConfig } from './service-config.types.ts';

export function registerLLMServices(container: DIContainer): void {
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
        concurrencyLimiter: openAILimiter,
      });
    },
    ['config']
  );

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
          errorThresholdPercentage: 60,
          resetTimeout: 15000,
        },
        concurrencyLimiter: groqLimiter,
      });
    },
    ['config']
  );

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
}
