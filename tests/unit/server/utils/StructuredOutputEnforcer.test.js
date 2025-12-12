import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StructuredOutputEnforcer } from '../../../../server/src/utils/StructuredOutputEnforcer.js';

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('StructuredOutputEnforcer', () => {
  let mockAIService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAIService = {
      execute: vi.fn(),
    };
  });

  it('throws if operation is missing', async () => {
    await expect(
      StructuredOutputEnforcer.enforceJSON(mockAIService, 'sys', /** @type {any} */ ({ }))
    ).rejects.toThrow(/operation/);
  });

  it('extracts valid JSON objects from AI responses', async () => {
    mockAIService.execute.mockResolvedValue({
      text: '{"name":"test","value":42}',
    });

    const result = await StructuredOutputEnforcer.enforceJSON(
      mockAIService,
      'Extract data',
      { operation: 'test_op' }
    );

    expect(result).toEqual({ name: 'test', value: 42 });
    expect(mockAIService.execute).toHaveBeenCalledWith(
      'test_op',
      expect.objectContaining({
        systemPrompt: expect.any(String),
      })
    );
  });

  it('auto-unwraps suggestions arrays when schema is object but isArray=true', async () => {
    mockAIService.execute.mockResolvedValue({
      text: '{"suggestions":[{"id":1},{"id":2}]}',
    });

    const result = await StructuredOutputEnforcer.enforceJSON(
      mockAIService,
      'Get suggestions',
      {
        operation: 'suggestions_op',
        isArray: true,
        schema: { type: 'object', required: ['suggestions'] },
      }
    );

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('retries on parse errors and returns the first valid JSON', async () => {
    mockAIService.execute
      .mockResolvedValueOnce({ text: 'not json' })
      .mockResolvedValueOnce({ text: '{"ok":true}' });

    const result = await StructuredOutputEnforcer.enforceJSON(
      mockAIService,
      'Retry please',
      { operation: 'retry_op', maxRetries: 1 }
    );

    expect(result).toEqual({ ok: true });
    expect(mockAIService.execute).toHaveBeenCalledTimes(2);
  });
});
