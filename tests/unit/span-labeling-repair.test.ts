import { describe, expect, it, beforeEach, vi } from 'vitest';

const mockCallModel = vi.fn();
const mockValidateSchemaOrThrow = vi.fn();
const mockValidateSpans = vi.fn();

vi.mock('@llm/span-labeling/services/robust-llm-client/modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

vi.mock('@llm/span-labeling/validation/SchemaValidator', () => ({
  validateSchemaOrThrow: (...args: unknown[]) => mockValidateSchemaOrThrow(...args),
}));

vi.mock('@llm/span-labeling/validation/SpanValidator', () => ({
  validateSpans: (...args: unknown[]) => mockValidateSpans(...args),
}));

describe('attemptRepair', () => {
  beforeEach(() => {
    mockCallModel.mockReset();
    mockValidateSchemaOrThrow.mockReset();
    mockValidateSpans.mockReset();
  });

  it('throws when repair response cannot be parsed', async () => {
    const { attemptRepair } = await import('@llm/span-labeling/services/robust-llm-client/repair');

    mockCallModel.mockResolvedValue({ text: 'bad', metadata: {} });

    await expect(
      attemptRepair({
        basePayload: { task: 't', policy: {}, text: 'x', templateVersion: 'v1' },
        validationErrors: ['oops'],
        originalResponse: {},
        text: 'x',
        policy: {},
        options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
        aiService: { execute: vi.fn() } as never,
        cache: { findBestMatch: vi.fn() } as never,
        estimatedMaxTokens: 10,
        providerOptions: { enableBookending: false, useFewShot: false, useSeedFromConfig: false, enableLogprobs: false },
        providerName: 'openai',
        parseResponseText: () => ({ ok: false, error: 'Invalid JSON' }),
        normalizeParsedResponse: (value) => value,
        injectDefensiveMeta: vi.fn(),
      })
    ).rejects.toThrow('Invalid JSON');
  });

  it('throws when repaired spans fail validation', async () => {
    const { attemptRepair } = await import('@llm/span-labeling/services/robust-llm-client/repair');

    mockCallModel.mockResolvedValue({ text: '{"spans":[]}', metadata: {} });
    mockValidateSpans.mockReturnValue({ ok: false, errors: ['bad'], result: { spans: [], meta: { version: 'v1', notes: '' } } });

    await expect(
      attemptRepair({
        basePayload: { task: 't', policy: {}, text: 'x', templateVersion: 'v1' },
        validationErrors: ['oops'],
        originalResponse: {},
        text: 'x',
        policy: {},
        options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
        aiService: { execute: vi.fn() } as never,
        cache: { findBestMatch: vi.fn() } as never,
        estimatedMaxTokens: 10,
        providerOptions: { enableBookending: false, useFewShot: false, useSeedFromConfig: false, enableLogprobs: false },
        providerName: 'openai',
        parseResponseText: () => ({ ok: true, value: { spans: [] } }),
        normalizeParsedResponse: (value) => value,
        injectDefensiveMeta: vi.fn(),
      })
    ).rejects.toThrow('Repair attempt failed validation');
  });

  it('returns validated repair result with metadata', async () => {
    const { attemptRepair } = await import('@llm/span-labeling/services/robust-llm-client/repair');

    mockCallModel.mockResolvedValue({ text: '{"spans":[]}', metadata: { repaired: true } });
    mockValidateSpans.mockReturnValue({ ok: true, result: { spans: [], meta: { version: 'v1', notes: '' } } });

    const result = await attemptRepair({
      basePayload: { task: 't', policy: {}, text: 'x', templateVersion: 'v1' },
      validationErrors: ['oops'],
      originalResponse: {},
      text: 'x',
      policy: {},
      options: { maxSpans: 5, minConfidence: 0.5, templateVersion: 'v1' },
      aiService: { execute: vi.fn() } as never,
      cache: { findBestMatch: vi.fn() } as never,
      estimatedMaxTokens: 10,
      providerOptions: { enableBookending: false, useFewShot: false, useSeedFromConfig: false, enableLogprobs: false },
      providerName: 'openai',
      parseResponseText: () => ({ ok: true, value: { spans: [] } }),
      normalizeParsedResponse: (value) => value,
      injectDefensiveMeta: vi.fn(),
    });

    expect(result.result.spans).toHaveLength(0);
    expect(result.metadata?.repaired).toBe(true);
  });
});
