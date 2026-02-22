import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DIContainer } from '@infrastructure/DIContainer';
import { registerGenerationServices } from '@config/services/generation.services';
import type { ServiceConfig } from '@config/services/service-config.types';

describe('keyframe service alias regression', () => {
  const originalFalKey = process.env.FAL_KEY;

  beforeEach(() => {
    process.env.FAL_KEY = 'fal_test_key';
  });

  afterEach(() => {
    if (originalFalKey === undefined) {
      delete process.env.FAL_KEY;
      return;
    }
    process.env.FAL_KEY = originalFalKey;
  });

  it('resolves keyframeService and keyframeGenerationService to the same singleton instance', () => {
    const container = new DIContainer();
    const config: ServiceConfig = {
      openai: { apiKey: undefined, timeout: 30000, model: 'gpt-4o-mini' },
      groq: { apiKey: undefined, timeout: 30000, model: 'llama-3.3-70b-versatile' },
      qwen: { apiKey: undefined, timeout: 30000, model: 'qwen/qwen3-coder' },
      gemini: {
        apiKey: undefined,
        timeout: 30000,
        model: 'gemini-2.5-flash',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
      },
      replicate: { apiToken: undefined },
      fal: { apiKey: process.env.FAL_KEY },
      redis: { defaultTTL: 3600, shortTTL: 300, maxMemoryCacheSize: 1000 },
      server: { port: '3001', environment: 'test' },
    };

    container.registerValue('config', config);
    registerGenerationServices(container);

    const generationService = container.resolve('keyframeGenerationService');
    const keyframeService = container.resolve('keyframeService');
    const keyframeServiceAgain = container.resolve('keyframeService');

    expect(keyframeService).toBe(generationService);
    expect(keyframeServiceAgain).toBe(generationService);
  });
});
