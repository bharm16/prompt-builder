import { describe, expect, it, vi } from 'vitest';

const mockFewShot = vi.fn();

vi.mock('@llm/span-labeling/utils/promptBuilder', () => ({
  getFewShotExamples: (...args: unknown[]) => mockFewShot(...args),
}));

describe('callModel', () => {
  it('passes base request options and returns text response', async () => {
    const { callModel } = await import('@llm/span-labeling/services/robust-llm-client/modelInvocation');

    const execute = vi.fn().mockResolvedValue({ text: '{"ok":true}', metadata: { provider: 'x' } });
    const aiService = { execute };

    const result = await callModel({
      systemPrompt: 'SYS',
      userPayload: '{"text":"hello"}',
      aiService: aiService as never,
      maxTokens: 123,
      providerOptions: {
        enableBookending: true,
        useFewShot: false,
        useSeedFromConfig: false,
        enableLogprobs: true,
      },
    });

    expect(result.text).toBe('{"ok":true}');
    expect(execute).toHaveBeenCalledWith('span_labeling', expect.objectContaining({
      systemPrompt: 'SYS',
      userMessage: '{"text":"hello"}',
      maxTokens: 123,
      jsonMode: true,
      enableBookending: true,
      useSeedFromConfig: false,
      logprobs: true,
    }));
  });

  it('builds few-shot messages and disables jsonMode when schema is provided', async () => {
    const { callModel } = await import('@llm/span-labeling/services/robust-llm-client/modelInvocation');

    mockFewShot.mockReturnValue([{ role: 'assistant', content: 'example' }]);

    const execute = vi.fn().mockResolvedValue({
      content: [{ text: '{"ok":true}' }],
      metadata: {},
    });
    const aiService = { execute };

    const userPayload = JSON.stringify({ text: '<user_input>\nhello\n</user_input>' });

    await callModel({
      systemPrompt: 'SYS',
      userPayload,
      aiService: aiService as never,
      maxTokens: 50,
      providerOptions: {
        enableBookending: false,
        useFewShot: true,
        useSeedFromConfig: true,
        enableLogprobs: false,
        providerName: 'groq',
      },
      schema: { schema: { type: 'object' } },
    });

    const request = execute.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(request.jsonMode).toBe(false);
    expect(request.enableSandwich).toBe(true);

    const messages = request.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[1]?.content).toBe('example');
    expect(messages[messages.length - 1]?.content).toContain('<user_input>');
  });
});
