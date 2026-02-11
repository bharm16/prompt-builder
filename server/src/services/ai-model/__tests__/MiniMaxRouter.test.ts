import { describe, expect, it, vi } from 'vitest';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { MiniMaxRouter } from '../MiniMaxRouter';

describe('MiniMaxRouter', () => {
  it('routes simple requests to *_mini operation', async () => {
    const execute = vi.fn().mockResolvedValue({ text: 'mini', metadata: {} });
    const router = new MiniMaxRouter({ execute } as never);

    const response = await router.route({
      operation: 'optimize_standard',
      systemPrompt: 'Extract date from this short input',
      userMessage: 'Jan 1',
    });

    expect(response.text).toBe('mini');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith(
      'optimize_standard_mini',
      expect.objectContaining({ enableBookending: true })
    );
  });

  it('falls back to GPT-4o when mini response fails validation', async () => {
    const execute = vi
      .fn()
      .mockResolvedValueOnce({ text: 'bad-mini', metadata: {} })
      .mockResolvedValueOnce({ text: 'gpt4o', metadata: {} });
    const router = new MiniMaxRouter({ execute } as never);

    const response = await router.route({
      operation: 'optimize_standard',
      systemPrompt: 'simple prompt',
      validateResponse: () => ({ valid: false, errors: ['bad structure'] }),
    });

    expect(response.text).toBe('gpt4o');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toBe('optimize_standard');
    expect(execute.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ model: 'gpt-4o-2024-08-06' })
    );
  });

  it('falls back to GPT-4o when mini request fails', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('mini failed'))
      .mockResolvedValueOnce({ text: 'gpt4o', metadata: {} });
    const router = new MiniMaxRouter({ execute } as never);

    const response = await router.route({
      operation: 'optimize_standard',
      systemPrompt: 'simple prompt',
    });

    expect(response.text).toBe('gpt4o');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ model: 'gpt-4o-2024-08-06' })
    );
  });

  it('falls back to original operation with mini model when *_mini operation is missing', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new Error('operation not found'))
      .mockResolvedValueOnce({ text: 'mini-via-override', metadata: {} });
    const router = new MiniMaxRouter({ execute } as never);

    const response = await router.route({
      operation: 'optimize_standard',
      systemPrompt: 'simple prompt',
    });

    expect(response.text).toBe('mini-via-override');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(execute.mock.calls[1]?.[0]).toBe('optimize_standard');
    expect(execute.mock.calls[1]?.[1]).toEqual(
      expect.objectContaining({ model: 'gpt-4o-mini-2024-07-18' })
    );
  });

  it('routes complex prompts directly to GPT-4o', async () => {
    const execute = vi.fn().mockResolvedValue({ text: 'gpt4o', metadata: {} });
    const router = new MiniMaxRouter({ execute } as never);

    const response = await router.route({
      operation: 'optimize_standard',
      systemPrompt: 'Draft a legal contract analysis with nuanced litigation risk synthesis.',
      userMessage: 'Include detailed legal reasoning and contract clause analysis.',
    });

    expect(response.text).toBe('gpt4o');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({ model: 'gpt-4o-2024-08-06' })
    );
  });
});
