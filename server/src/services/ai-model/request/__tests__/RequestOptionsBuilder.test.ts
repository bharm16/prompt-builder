import { describe, expect, it, vi } from 'vitest';

const { shouldUseSeedMock, hashStringMock, resolveDeveloperMessageMock } = vi.hoisted(() => ({
  shouldUseSeedMock: vi.fn(),
  hashStringMock: vi.fn(),
  resolveDeveloperMessageMock: vi.fn(),
}));

vi.mock('@config/modelConfig', () => ({
  shouldUseSeed: shouldUseSeedMock,
}));

vi.mock('@utils/hash', () => ({
  hashString: hashStringMock,
}));

vi.mock('../../policy/DeveloperMessagePolicy', () => ({
  resolveDeveloperMessage: resolveDeveloperMessageMock,
}));

import { buildRequestOptions } from '../RequestOptionsBuilder';

const baseConfig = {
  client: 'openai',
  model: 'gpt-4o',
  temperature: 0.2,
  maxTokens: 1000,
  timeout: 30000,
};

describe('buildRequestOptions', () => {
  it('builds request options from config defaults and param overrides', () => {
    shouldUseSeedMock.mockReturnValue(false);
    resolveDeveloperMessageMock.mockReturnValue(undefined);

    const options = buildRequestOptions({
      operation: 'op',
      params: {
        systemPrompt: 'prompt',
        temperature: 0.7,
      },
      config: baseConfig,
      capabilities: { bookending: true, developerRole: false } as never,
      jsonMode: true,
    });

    expect(options.model).toBe('gpt-4o');
    expect(options.temperature).toBe(0.7);
    expect(options.maxTokens).toBe(1000);
    expect(options.timeout).toBe(30000);
    expect(options.jsonMode).toBe(true);
    expect(options.enableBookending).toBe(true);
  });

  it('adds developerMessage when provider supports developer role', () => {
    shouldUseSeedMock.mockReturnValue(false);
    resolveDeveloperMessageMock.mockReturnValue('dev-rules');

    const options = buildRequestOptions({
      operation: 'op',
      params: { systemPrompt: 'prompt' },
      config: baseConfig,
      capabilities: {
        bookending: true,
        developerRole: true,
        strictJsonSchema: true,
      } as never,
      jsonMode: false,
    });

    expect(resolveDeveloperMessageMock).toHaveBeenCalledTimes(1);
    expect(options.developerMessage).toBe('dev-rules');
  });

  it('prefers explicit seed and falls back to hash seed when configured', () => {
    resolveDeveloperMessageMock.mockReturnValue(undefined);
    shouldUseSeedMock.mockReturnValue(true);
    hashStringMock.mockReturnValue(42);

    const hashed = buildRequestOptions({
      operation: 'seed-op',
      params: { systemPrompt: 'prompt' },
      config: baseConfig,
      capabilities: { bookending: true, developerRole: false } as never,
      jsonMode: false,
    });
    expect(hashed.seed).toBe(42);

    const explicit = buildRequestOptions({
      operation: 'seed-op',
      params: { systemPrompt: 'prompt', seed: 999 },
      config: baseConfig,
      capabilities: { bookending: true, developerRole: false } as never,
      jsonMode: false,
    });
    expect(explicit.seed).toBe(999);
  });

  it('passes through logprobs and topLogprobs options', () => {
    shouldUseSeedMock.mockReturnValue(false);
    resolveDeveloperMessageMock.mockReturnValue(undefined);

    const options = buildRequestOptions({
      operation: 'logprobs-op',
      params: {
        systemPrompt: 'prompt',
        logprobs: true,
        topLogprobs: 3,
      },
      config: baseConfig,
      capabilities: { bookending: false, developerRole: false } as never,
      jsonMode: false,
    });

    expect(options.logprobs).toBe(true);
    expect(options.topLogprobs).toBe(3);
  });
});
