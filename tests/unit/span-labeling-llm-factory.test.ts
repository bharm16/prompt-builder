import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

import { GroqLlmClient } from '@llm/span-labeling/services/GroqLlmClient';
import { OpenAILlmClient } from '@llm/span-labeling/services/OpenAILlmClient';
import { RobustLlmClient } from '@llm/span-labeling/services/RobustLlmClient';

const mockDetectProvider = vi.fn();

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectProvider: (args: { model?: string }) => mockDetectProvider(args),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('LlmClientFactory', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockDetectProvider.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('creates provider-specific clients when explicitly specified', async () => {
    const { createLlmClient } = await import('@llm/span-labeling/services/LlmClientFactory');
    const client = createLlmClient({ provider: 'openai' });
    expect(client).toBeInstanceOf(OpenAILlmClient);
  });

  it('uses SPAN_PROVIDER from environment', async () => {
    process.env.SPAN_PROVIDER = 'groq';
    const { createLlmClient } = await import('@llm/span-labeling/services/LlmClientFactory');
    const client = createLlmClient();
    expect(client).toBeInstanceOf(GroqLlmClient);
  });

  it('auto-detects provider based on model name', async () => {
    mockDetectProvider.mockReturnValue('openai');
    process.env.SPAN_MODEL = 'gpt-4o';

    const { createLlmClient } = await import('@llm/span-labeling/services/LlmClientFactory');
    const client = createLlmClient();
    expect(client).toBeInstanceOf(OpenAILlmClient);
  });

  it('falls back to robust client for unknown providers', async () => {
    const { createLlmClient } = await import('@llm/span-labeling/services/LlmClientFactory');
    const client = createLlmClient({ provider: 'unknown' });
    expect(client).toBeInstanceOf(RobustLlmClient);
  });
});
