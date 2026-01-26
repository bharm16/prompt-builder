import { describe, expect, it, vi } from 'vitest';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe('nlp log', () => {
  it('creates a child logger with the NlpSpanService tag', async () => {
    vi.resetModules();
    const { logger } = await import('@infrastructure/Logger');
    const { log } = await import('@llm/span-labeling/nlp/log');

    expect(log).toBeDefined();
    expect(logger.child).toHaveBeenCalledWith({ service: 'NlpSpanService' });
  });
});
