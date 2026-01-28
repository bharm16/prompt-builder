import { logger } from '@infrastructure/Logger';
import { ModelConfig, DEFAULT_CONFIG } from '@config/modelConfig';
import { AIClientError } from '@interfaces/IAIClient';
import type { ExecutionPlan, ModelConfigEntry } from '../types';
import type { ClientResolver } from './ClientResolver';

const DEFAULT_FALLBACK_ORDER = ['openai', 'groq', 'gemini', 'qwen'] as const;

const DEFAULT_PROVIDER_SETTINGS: Record<string, { model: string; timeout: number }> = {
  openai: {
    model: process.env.OPENAI_MODEL || DEFAULT_CONFIG.model,
    timeout: Number.parseInt(process.env.OPENAI_TIMEOUT_MS || String(DEFAULT_CONFIG.timeout), 10),
  },
  groq: {
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    timeout: Number.parseInt(process.env.GROQ_TIMEOUT_MS || '5000', 10),
  },
  qwen: {
    model: process.env.QWEN_MODEL || 'qwen/qwen3-32b',
    timeout: Number.parseInt(process.env.QWEN_TIMEOUT_MS || '10000', 10),
  },
  gemini: {
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    timeout: Number.parseInt(process.env.GEMINI_TIMEOUT_MS || '30000', 10),
  },
};

export class ExecutionPlanResolver {
  private readonly loggedAutoFallbacks = new Set<string>();

  constructor(private readonly clientResolver: ClientResolver) {}

  getConfig(operation: string): ModelConfigEntry {
    const config = ModelConfig[operation] as ModelConfigEntry | undefined;

    if (!config) {
      logger.warn('Operation not found in config, using default', {
        operation,
        availableOperations: Object.keys(ModelConfig).slice(0, 5),
      } as Record<string, unknown>);
      return DEFAULT_CONFIG as ModelConfigEntry;
    }

    return config;
  }

  resolve(operation: string): ExecutionPlan {
    const baseConfig = this.getConfig(operation);
    const primaryAvailable = this.clientResolver.hasClient(baseConfig.client);

    if (!primaryAvailable) {
      const replacement = this.selectAvailableClient(baseConfig.fallbackTo, baseConfig.fallbackConfig);
      if (replacement) {
        const config: ModelConfigEntry = {
          ...baseConfig,
          client: replacement.client,
          model: replacement.model,
          timeout: replacement.timeout,
        };

        if (!this.loggedAutoFallbacks.has(operation)) {
          this.loggedAutoFallbacks.add(operation);
          logger.warn('Primary client unavailable, remapping operation to available provider', {
            operation,
            requestedClient: baseConfig.client,
            resolvedClient: replacement.client,
          });
        }

        return {
          primaryConfig: config,
          fallback: this.resolveFallbackClient(replacement.client, baseConfig),
        };
      }
    }

    if (!primaryAvailable && !this.clientResolver.hasAnyClient()) {
      throw new AIClientError('No AI providers configured; enable at least one LLM provider', 503);
    }

    return {
      primaryConfig: baseConfig,
      fallback: this.resolveFallbackClient(baseConfig.client, baseConfig),
    };
  }

  private resolveFallbackClient(
    primaryClient: string,
    baseConfig: ModelConfigEntry
  ): { client: string; model: string; timeout: number } | null {
    if (baseConfig.fallbackTo && baseConfig.fallbackTo !== primaryClient && this.clientResolver.hasClient(baseConfig.fallbackTo)) {
      return {
        client: baseConfig.fallbackTo,
        model: baseConfig.fallbackConfig?.model || this.getDefaultProviderModel(baseConfig.fallbackTo),
        timeout: baseConfig.fallbackConfig?.timeout || this.getDefaultProviderTimeout(baseConfig.fallbackTo),
      };
    }

    for (const candidate of DEFAULT_FALLBACK_ORDER) {
      if (candidate !== primaryClient && this.clientResolver.hasClient(candidate)) {
        return {
          client: candidate,
          model: this.getDefaultProviderModel(candidate),
          timeout: this.getDefaultProviderTimeout(candidate),
        };
      }
    }

    return null;
  }

  private selectAvailableClient(
    preferred?: string,
    fallbackConfig?: { model: string; timeout: number }
  ): { client: string; model: string; timeout: number } | null {
    if (preferred && this.clientResolver.hasClient(preferred)) {
      return {
        client: preferred,
        model: fallbackConfig?.model || this.getDefaultProviderModel(preferred),
        timeout: fallbackConfig?.timeout || this.getDefaultProviderTimeout(preferred),
      };
    }

    for (const candidate of DEFAULT_FALLBACK_ORDER) {
      if (this.clientResolver.hasClient(candidate)) {
        return {
          client: candidate,
          model: this.getDefaultProviderModel(candidate),
          timeout: this.getDefaultProviderTimeout(candidate),
        };
      }
    }

    const firstAvailable = this.clientResolver.getAvailableClients()[0];
    if (firstAvailable) {
      return {
        client: firstAvailable,
        model: this.getDefaultProviderModel(firstAvailable),
        timeout: this.getDefaultProviderTimeout(firstAvailable),
      };
    }

    return null;
  }

  private getDefaultProviderModel(provider: string): string {
    return DEFAULT_PROVIDER_SETTINGS[provider]?.model || DEFAULT_CONFIG.model;
  }

  private getDefaultProviderTimeout(provider: string): number {
    return DEFAULT_PROVIDER_SETTINGS[provider]?.timeout || DEFAULT_CONFIG.timeout;
  }
}
