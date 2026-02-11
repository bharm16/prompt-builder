import { describe, expect, it, vi } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    warn: vi.fn(),
  },
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: loggerMock,
}));

vi.mock('@interfaces/IAIClient', () => ({
  AIClientError: class AIClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'AIClientError';
      this.statusCode = statusCode;
    }
  },
}));

vi.mock('@config/modelConfig', () => ({
  ModelConfig: {
    op_primary: {
      client: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 1000,
      timeout: 20000,
      fallbackTo: 'groq',
      fallbackConfig: { model: 'llama', timeout: 5000 },
    },
    op_missing_primary: {
      client: 'openai',
      model: 'gpt-4o',
      temperature: 0.2,
      maxTokens: 1000,
      timeout: 20000,
      fallbackTo: 'gemini',
      fallbackConfig: { model: 'gemini-2.5-flash', timeout: 30000 },
    },
  },
  DEFAULT_CONFIG: {
    client: 'openai',
    model: 'gpt-4o-mini',
    temperature: 0,
    maxTokens: 512,
    timeout: 10000,
  },
}));

import { ExecutionPlanResolver } from '../ExecutionPlan';

function createResolver(overrides: Partial<{
  hasClient: (name: string) => boolean;
  hasAnyClient: () => boolean;
  getAvailableClients: () => string[];
}> = {}) {
  const clientResolver = {
    hasClient: (name: string) => name === 'openai' || name === 'groq',
    hasAnyClient: () => true,
    getAvailableClients: () => ['openai', 'groq'],
    ...overrides,
  };
  return new ExecutionPlanResolver(clientResolver as never);
}

describe('ExecutionPlanResolver', () => {
  it('returns configured operation config', () => {
    const resolver = createResolver();

    const config = resolver.getConfig('op_primary');

    expect(config.client).toBe('openai');
    expect(config.model).toBe('gpt-4o');
  });

  it('falls back to DEFAULT_CONFIG when operation is missing', () => {
    const resolver = createResolver();

    const config = resolver.getConfig('unknown-operation');

    expect(config.model).toBe('gpt-4o-mini');
    expect(loggerMock.warn).toHaveBeenCalledTimes(1);
  });

  it('uses primary config and fallback when primary client is available', () => {
    const resolver = createResolver();

    const plan = resolver.resolve('op_primary');

    expect(plan.primaryConfig.client).toBe('openai');
    expect(plan.fallback).toEqual({
      client: 'groq',
      model: 'llama',
      timeout: 5000,
    });
  });

  it('remaps operation to available fallback client when primary is missing', () => {
    const resolver = createResolver({
      hasClient: (name: string) => name === 'gemini',
      getAvailableClients: () => ['gemini'],
    });

    const plan = resolver.resolve('op_missing_primary');

    expect(plan.primaryConfig.client).toBe('gemini');
    expect(plan.primaryConfig.model).toBe('gemini-2.5-flash');
  });

  it('throws when no AI providers are configured', () => {
    const resolver = createResolver({
      hasClient: () => false,
      hasAnyClient: () => false,
      getAvailableClients: () => [],
    });

    expect(() => resolver.resolve('op_primary')).toThrow('No AI providers configured');
  });
});
