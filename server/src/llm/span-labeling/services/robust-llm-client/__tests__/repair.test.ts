import { describe, it, expect, vi, beforeEach } from 'vitest';
import { attemptRepair } from '../repair';

const mockCallModel = vi.fn();
const mockValidateSchema = vi.fn();
const mockValidateSpans = vi.fn();
const mockFormatValidationErrors = vi.fn(() => 'formatted errors');
const normalizeParsedResponse = <T extends Record<string, unknown>>(value: T): T => value;

vi.mock('../modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

vi.mock('../../../validation/SchemaValidator', () => ({
  validateSchemaOrThrow: (...args: unknown[]) => mockValidateSchema(...args),
}));

vi.mock('../../../validation/SpanValidator', () => ({
  validateSpans: (...args: unknown[]) => mockValidateSpans(...args),
}));

vi.mock('../../../utils/textUtils', () => ({
  formatValidationErrors: () => mockFormatValidationErrors(),
}));

const baseParams = {
  basePayload: {
    task: 'label',
    policy: {},
    text: 'prompt',
    templateVersion: 'v1',
  },
  validationErrors: ['bad'],
  originalResponse: { spans: [] },
  text: 'prompt',
  policy: {},
  options: {},
  aiService: {} as unknown as any,
  cache: {} as unknown as any,
  estimatedMaxTokens: 100,
  providerOptions: {
    enableBookending: false,
    useFewShot: false,
    useSeedFromConfig: false,
    enableLogprobs: false,
  },
  providerName: 'openai',
  parseResponseText: (_: string): { ok: true; value: { spans: never[]; meta: { version: string; notes: string } } } => ({
    ok: true,
    value: { spans: [], meta: { version: 'v1', notes: '' } },
  }),
  normalizeParsedResponse,
  injectDefensiveMeta: vi.fn(),
};

describe('attemptRepair', () => {
  beforeEach(() => {
    mockCallModel.mockReset();
    mockValidateSchema.mockReset();
    mockValidateSpans.mockReset();
    mockFormatValidationErrors.mockReset();
  });

  describe('error handling', () => {
    it('throws when response cannot be parsed', async () => {
      mockCallModel.mockResolvedValue({ text: 'bad', metadata: {} });
      const params = {
        ...baseParams,
        parseResponseText: (): { ok: false; error: string } => ({ ok: false, error: 'parse failed' }),
      };

      await expect(attemptRepair(params)).rejects.toThrow('parse failed');
    });
  });

  describe('edge cases', () => {
    it('throws formatted validation errors when repair validation fails', async () => {
      mockCallModel.mockResolvedValue({ text: '{"spans": []}', metadata: {} });
      mockValidateSpans.mockReturnValue({ ok: false, errors: ['x'], result: { spans: [], meta: { version: 'v1', notes: '' } } });

      await expect(attemptRepair(baseParams)).rejects.toThrow('Repair attempt failed validation');
      expect(mockFormatValidationErrors).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('returns validated result and metadata on success', async () => {
      mockCallModel.mockResolvedValue({ text: '{"spans": []}', metadata: { provider: 'test' } });
      mockValidateSpans.mockReturnValue({ ok: true, errors: [], result: { spans: [], meta: { version: 'v1', notes: 'ok' } } });

      const result = await attemptRepair(baseParams);

      expect(result.result.meta.notes).toBe('ok');
      expect(result.metadata?.provider).toBe('test');
    });
  });
});
