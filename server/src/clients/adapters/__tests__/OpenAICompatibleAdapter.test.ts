import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { OpenAICompatibleAdapter } from '../OpenAICompatibleAdapter';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(function child() { return this; }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('OpenAICompatibleAdapter', () => {
  let adapter: OpenAICompatibleAdapter;
  let mockFetch: MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    adapter = new OpenAICompatibleAdapter({
      apiKey: 'test-key',
      baseURL: 'https://api.openai.com/v1',
      defaultModel: 'gpt-4o-mini',
      defaultTimeout: 1000,
      providerName: 'openai',
    });
  });

  it('exposes OpenAI capabilities', () => {
    expect(adapter.capabilities.streaming).toBe(true);
    expect(adapter.capabilities.seed).toBe(true);
    expect(adapter.capabilities.logprobs).toBe(true);
    expect(adapter.capabilities.predictedOutputs).toBe(true);
    expect(adapter.capabilities.developerRole).toBe(true);
    expect(adapter.capabilities.structuredOutputs).toBe(true);
  });

  it('uses json_schema when schema provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    } as Response);

    await adapter.complete('Return JSON', {
      schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
      userMessage: 'hi',
    });

    const payload = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(payload.response_format?.type).toBe('json_schema');
    expect(payload.frequency_penalty).toBe(0);
  });

  it('uses json_object for jsonMode objects', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    } as Response);

    await adapter.complete('Return JSON', { jsonMode: true, userMessage: 'hi' });

    const payload = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(payload.response_format).toEqual({ type: 'json_object' });
    expect(payload.frequency_penalty).toBe(0);
  });

  it('sets top_p only when temperature is 0', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"ok":true}' } }] }),
    } as Response);

    await adapter.complete('Return JSON', { jsonMode: true, temperature: 0, userMessage: 'hi' });
    let payload = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(payload.top_p).toBe(1);

    mockFetch.mockClear();
    await adapter.complete('Return JSON', { jsonMode: true, temperature: 0.3, userMessage: 'hi' });
    payload = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
    expect(payload.top_p).toBeUndefined();
  });
});

