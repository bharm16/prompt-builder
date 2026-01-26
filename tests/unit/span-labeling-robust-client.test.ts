import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockCallModel = vi.fn();
const mockValidateSchemaOrThrow = vi.fn();
const mockValidateSpans = vi.fn();
const mockAttemptRepair = vi.fn();
const mockInjectDefensiveMeta = vi.fn();

vi.mock('@llm/span-labeling/services/robust-llm-client/modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

vi.mock('@llm/span-labeling/validation/SchemaValidator', () => ({
  validateSchemaOrThrow: (...args: unknown[]) => mockValidateSchemaOrThrow(...args),
}));

vi.mock('@llm/span-labeling/validation/SpanValidator', () => ({
  validateSpans: (...args: unknown[]) => mockValidateSpans(...args),
}));

vi.mock('@llm/span-labeling/services/robust-llm-client/repair', () => ({
  attemptRepair: (...args: unknown[]) => mockAttemptRepair(...args),
}));

vi.mock('@llm/span-labeling/services/robust-llm-client/defensiveMeta', () => ({
  injectDefensiveMeta: (...args: unknown[]) => mockInjectDefensiveMeta(...args),
}));

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: () => ({ provider: 'unknown', capabilities: { strictJsonSchema: false } }),
}));

vi.mock('@utils/provider/SchemaFactory', () => ({
  getSpanLabelingSchema: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('RobustLlmClient', () => {
  beforeEach(() => {
    mockCallModel.mockReset();
    mockValidateSchemaOrThrow.mockReset();
    mockValidateSpans.mockReset();
    mockAttemptRepair.mockReset();
    mockInjectDefensiveMeta.mockReset();
  });

  it('throws when JSON parsing fails', async () => {
    const { RobustLlmClient } = await import('@llm/span-labeling/services/RobustLlmClient');
    const client = new RobustLlmClient();

    mockCallModel.mockResolvedValue({ text: 'not json', metadata: {} });

    await expect(
      client.getSpans({
        text: 'Hello',
        policy: { allowOverlap: false },
        options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
        enableRepair: false,
        aiService: { execute: vi.fn() } as never,
        cache: { findBestMatch: vi.fn() } as never,
      })
    ).rejects.toThrow('Invalid JSON');
  });

  it('returns validated empty spans when response is adversarial', async () => {
    const { RobustLlmClient } = await import('@llm/span-labeling/services/RobustLlmClient');
    const client = new RobustLlmClient();

    mockCallModel.mockResolvedValue({
      text: JSON.stringify({ spans: [{ text: 'x', role: 'subject.identity' }], meta: { version: 'v1', notes: '' }, isAdversarial: true }),
      metadata: {},
    });

    mockValidateSpans.mockImplementation((params: { meta: Record<string, unknown> }) => ({
      ok: true,
      result: { spans: [], meta: params.meta, isAdversarial: true },
    }));

    const result = await client.getSpans({
      text: 'Hello',
      policy: { allowOverlap: false },
      options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
      enableRepair: false,
      aiService: { execute: vi.fn() } as never,
      cache: { findBestMatch: vi.fn() } as never,
    });

    expect(result.spans).toHaveLength(0);
    expect(result.isAdversarial).toBe(true);
  });

  it('falls back to lenient validation when repair is disabled', async () => {
    const { RobustLlmClient } = await import('@llm/span-labeling/services/RobustLlmClient');
    const client = new RobustLlmClient();

    mockCallModel.mockResolvedValue({
      text: JSON.stringify({ spans: [{ text: 'cat', role: 'subject.identity', start: 0, end: 3 }], meta: { version: 'v1', notes: '' } }),
      metadata: {},
    });

    mockValidateSpans.mockImplementation((params: { attempt: number; spans: unknown[]; meta: Record<string, unknown> }) => {
      if (params.attempt === 1) {
        return { ok: false, errors: ['bad'], result: { spans: [], meta: params.meta } };
      }
      return { ok: true, result: { spans: params.spans, meta: params.meta } };
    });

    const result = await client.getSpans({
      text: 'Hello',
      policy: { allowOverlap: false },
      options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
      enableRepair: false,
      aiService: { execute: vi.fn() } as never,
      cache: { findBestMatch: vi.fn() } as never,
    });

    expect(result.spans).toHaveLength(1);
  });

  it('uses repair pipeline when enabled and validation fails', async () => {
    const { RobustLlmClient } = await import('@llm/span-labeling/services/RobustLlmClient');
    const client = new RobustLlmClient();

    mockCallModel.mockResolvedValue({
      text: JSON.stringify({ spans: [{ text: 'cat', role: 'subject.identity', start: 0, end: 3 }], meta: { version: 'v1', notes: '' } }),
      metadata: {},
    });

    mockValidateSpans.mockReturnValue({ ok: false, errors: ['bad'], result: { spans: [], meta: { version: 'v1', notes: '' } } });

    mockAttemptRepair.mockResolvedValue({
      result: { spans: [{ text: 'cat', role: 'subject.identity', start: 0, end: 3 }], meta: { version: 'v1', notes: '' } },
      metadata: { repaired: true },
    });

    const result = await client.getSpans({
      text: 'Hello',
      policy: { allowOverlap: false },
      options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
      enableRepair: true,
      aiService: { execute: vi.fn() } as never,
      cache: { findBestMatch: vi.fn() } as never,
    });

    expect(result.spans).toHaveLength(1);
    expect(mockAttemptRepair).toHaveBeenCalled();
  });
});
