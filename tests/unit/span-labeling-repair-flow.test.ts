import { describe, it, expect, vi, beforeEach } from 'vitest';

const callModelMock = vi.fn();
vi.mock('@llm/span-labeling/services/robust-llm-client/modelInvocation.js', () => ({
  callModel: (...args: unknown[]) => callModelMock(...args),
}));

const validateSchemaOrThrowMock = vi.fn();
vi.mock('@llm/span-labeling/validation/SchemaValidator.js', () => ({
  validateSchemaOrThrow: (...args: unknown[]) => validateSchemaOrThrowMock(...args),
}));

const validateSpansMock = vi.fn();
vi.mock('@llm/span-labeling/validation/SpanValidator.js', () => ({
  validateSpans: (...args: unknown[]) => validateSpansMock(...args),
}));

const detectAndGetCapabilitiesMock = vi.fn();
vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: (...args: unknown[]) => detectAndGetCapabilitiesMock(...args),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { attemptRepair } from '@llm/span-labeling/services/robust-llm-client/repair.js';
import { twoPassExtraction } from '@llm/span-labeling/services/robust-llm-client/twoPassExtraction.js';

const basePayload = {
  task: 'label',
  policy: { allowOverlap: false },
  text: 'hello',
  templateVersion: 'v2',
};

const baseOptions = { templateVersion: 'v2', minConfidence: 0.5 };

describe('attemptRepair', () => {
  beforeEach(() => {
    callModelMock.mockReset();
    validateSchemaOrThrowMock.mockReset();
    validateSpansMock.mockReset();
  });

  describe('error handling', () => {
    it('throws when repaired spans still fail validation', async () => {
      callModelMock.mockResolvedValue({ text: '{"spans":[]}', metadata: { provider: 'mock' } });
      validateSpansMock.mockReturnValue({
        ok: false,
        errors: ['bad indices'],
        result: { spans: [], meta: { version: 'v1', notes: '' } },
      });

      const parseResponseText = () => ({ ok: true, value: { spans: [], meta: { version: 'v1', notes: '' } } });

      await expect(
        attemptRepair({
          basePayload,
          validationErrors: ['bad indices'],
          originalResponse: { spans: [] },
          text: 'hello',
          policy: { allowOverlap: false },
          options: baseOptions,
          aiService: {} as never,
          cache: {} as never,
          estimatedMaxTokens: 10,
          providerOptions: {
            enableBookending: false,
            useFewShot: false,
            useSeedFromConfig: true,
            enableLogprobs: false,
          },
          providerName: 'groq',
          parseResponseText,
          normalizeParsedResponse: (value) => value,
          injectDefensiveMeta: vi.fn(),
        })
      ).rejects.toThrow('Repair attempt failed validation');
    });
  });

  describe('edge cases', () => {
    it('injects defensive meta for gemini responses', async () => {
      callModelMock.mockResolvedValue({ text: '{"spans":[]}', metadata: { provider: 'mock' } });
      validateSpansMock.mockReturnValue({
        ok: true,
        errors: [],
        result: { spans: [], meta: { version: 'v1', notes: '' } },
      });

      const parseResponseText = () => ({ ok: true, value: { spans: [], meta: { version: 'v1', notes: '' } } });
      const injectDefensiveMeta = vi.fn();

      const result = await attemptRepair({
        basePayload,
        validationErrors: ['bad indices'],
        originalResponse: { spans: [] },
        text: 'hello',
        policy: { allowOverlap: false },
        options: baseOptions,
        aiService: {} as never,
        cache: {} as never,
        estimatedMaxTokens: 10,
        providerOptions: {
          enableBookending: false,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'gemini',
        parseResponseText,
        normalizeParsedResponse: (value) => value,
        injectDefensiveMeta,
      });

      expect(result.result.spans).toEqual([]);
      expect(injectDefensiveMeta).toHaveBeenCalled();
    });
  });

  describe('core behavior', () => {
    it('returns validated spans and metadata from the repair call', async () => {
      callModelMock.mockResolvedValue({ text: '{"spans":[]}', metadata: { provider: 'mock', retry: true } });
      validateSpansMock.mockReturnValue({
        ok: true,
        errors: [],
        result: { spans: [{ text: 'Hero', role: 'subject' }], meta: { version: 'v1', notes: '' } },
      });

      const parseResponseText = () => ({
        ok: true,
        value: { spans: [{ text: 'Hero', role: 'subject' }], meta: { version: 'v1', notes: '' } },
      });

      const result = await attemptRepair({
        basePayload,
        validationErrors: ['bad indices'],
        originalResponse: { spans: [] },
        text: 'hello',
        policy: { allowOverlap: false },
        options: baseOptions,
        aiService: {} as never,
        cache: {} as never,
        estimatedMaxTokens: 10,
        providerOptions: {
          enableBookending: false,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'groq',
        parseResponseText,
        normalizeParsedResponse: (value) => value,
        injectDefensiveMeta: vi.fn(),
      });

      const payload = JSON.parse(callModelMock.mock.calls[0]?.[0]?.userPayload as string) as { validation?: { errors?: string[] } };
      expect(payload.validation?.errors).toEqual(['bad indices']);
      expect(result.metadata?.retry).toBe(true);
      expect(result.result.spans[0]?.text).toBe('Hero');
    });
  });
});

describe('twoPassExtraction', () => {
  beforeEach(() => {
    callModelMock.mockReset();
    detectAndGetCapabilitiesMock.mockReset();
  });

  describe('error handling', () => {
    it('propagates model errors from the first pass', async () => {
      detectAndGetCapabilitiesMock.mockReturnValue({ capabilities: { developerRole: false } });
      callModelMock.mockRejectedValue(new Error('boom'));

      await expect(
        twoPassExtraction({
          systemPrompt: 'SYS',
          userPayload: JSON.stringify({ task: 't', policy: {}, text: 't', templateVersion: 'v1' }),
          aiService: {} as never,
          maxTokens: 100,
          providerOptions: {
            enableBookending: false,
            useFewShot: false,
            useSeedFromConfig: true,
            enableLogprobs: false,
          },
          providerName: 'openai',
        })
      ).rejects.toThrow('boom');
    });
  });

  describe('edge cases', () => {
    it('omits developer message when the provider lacks developer role support', async () => {
      detectAndGetCapabilitiesMock.mockReturnValue({ capabilities: { developerRole: false } });
      callModelMock
        .mockResolvedValueOnce({ text: 'analysis', metadata: {} })
        .mockResolvedValueOnce({ text: 'structured', metadata: { pass: 2 } });

      const result = await twoPassExtraction({
        systemPrompt: 'SYS',
        userPayload: JSON.stringify({ task: 't', policy: {}, text: 't', templateVersion: 'v1' }),
        aiService: {} as never,
        maxTokens: 100,
        providerOptions: {
          enableBookending: true,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'openai',
      });

      const secondCall = callModelMock.mock.calls[1]?.[0] as { providerOptions?: { developerMessage?: string } };
      expect(secondCall.providerOptions?.developerMessage).toBeUndefined();
      expect(result.text).toBe('structured');
    });
  });

  describe('core behavior', () => {
    it('adds developer message when supported and returns second pass output', async () => {
      detectAndGetCapabilitiesMock.mockReturnValue({ capabilities: { developerRole: true } });
      callModelMock
        .mockResolvedValueOnce({ text: 'analysis', metadata: {} })
        .mockResolvedValueOnce({ text: 'structured', metadata: { pass: 2 } });

      const result = await twoPassExtraction({
        systemPrompt: 'SYS',
        userPayload: JSON.stringify({ task: 't', policy: {}, text: 't', templateVersion: 'v1' }),
        aiService: {} as never,
        maxTokens: 100,
        providerOptions: {
          enableBookending: true,
          useFewShot: false,
          useSeedFromConfig: true,
          enableLogprobs: false,
        },
        providerName: 'openai',
      });

      const secondCall = callModelMock.mock.calls[1]?.[0] as { providerOptions?: { developerMessage?: string } };
      expect(secondCall.providerOptions?.developerMessage).toContain('STRUCTURING MODE');
      expect(result.text).toBe('structured');
    });
  });
});
