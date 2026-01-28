import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RobustLlmClient } from '../RobustLlmClient';
import type { LabelSpansResult } from '../../types';

const mockBuildTaskDescription = vi.fn(() => 'task');
const mockBuildUserPayload = vi.fn(() => '{"text":"payload"}');
const mockParseJson = vi.fn();
const mockValidateSchema = vi.fn();
const mockValidateSpans = vi.fn();
const mockBuildSystemPrompt = vi.fn(() => 'system');
const mockDetectAndGetCapabilities = vi.fn();
const mockGetSpanLabelingSchema = vi.fn();
const mockAttemptRepair = vi.fn();
const mockCallModel = vi.fn();
const mockTwoPassExtraction = vi.fn();

vi.mock('../../utils/policyUtils', () => ({
  buildTaskDescription: () => mockBuildTaskDescription(),
}));

vi.mock('../../utils/jsonUtils', () => ({
  buildUserPayload: () => mockBuildUserPayload(),
  parseJson: (...args: unknown[]) => mockParseJson(...args),
}));

vi.mock('../../validation/SchemaValidator', () => ({
  validateSchemaOrThrow: (...args: unknown[]) => mockValidateSchema(...args),
}));

vi.mock('../../validation/SpanValidator', () => ({
  validateSpans: (...args: unknown[]) => mockValidateSpans(...args),
}));

vi.mock('../../utils/promptBuilder', () => ({
  buildSystemPrompt: () => mockBuildSystemPrompt(),
}));

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: (...args: unknown[]) => mockDetectAndGetCapabilities(...args),
}));

vi.mock('@utils/provider/SchemaFactory', () => ({
  getSpanLabelingSchema: (...args: unknown[]) => mockGetSpanLabelingSchema(...args),
}));

vi.mock('../robust-llm-client/repair', () => ({
  attemptRepair: (...args: unknown[]) => mockAttemptRepair(...args),
}));

vi.mock('../robust-llm-client/modelInvocation', () => ({
  callModel: (...args: unknown[]) => mockCallModel(...args),
}));

vi.mock('../robust-llm-client/twoPassExtraction', () => ({
  twoPassExtraction: (...args: unknown[]) => mockTwoPassExtraction(...args),
}));

describe('RobustLlmClient', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockBuildTaskDescription.mockReset();
    mockBuildUserPayload.mockReset();
    mockParseJson.mockReset();
    mockValidateSchema.mockReset();
    mockValidateSpans.mockReset();
    mockBuildSystemPrompt.mockReset();
    mockDetectAndGetCapabilities.mockReset();
    mockGetSpanLabelingSchema.mockReset();
    mockAttemptRepair.mockReset();
    mockCallModel.mockReset();
    mockTwoPassExtraction.mockReset();
    process.env = { ...originalEnv };

    mockDetectAndGetCapabilities.mockReturnValue({
      provider: 'openai',
      capabilities: { strictJsonSchema: false },
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const baseParams = {
    text: 'prompt',
    policy: {},
    options: { maxSpans: 5, minConfidence: 0.2, templateVersion: 'v1' },
    enableRepair: false,
    aiService: {} as unknown as any,
    cache: {} as unknown as any,
  };

  describe('error handling', () => {
    it('throws when JSON parsing fails', async () => {
      mockCallModel.mockResolvedValue({ text: 'bad', metadata: {} });
      mockParseJson.mockReturnValue({ ok: false, error: 'bad json' });

      const client = new RobustLlmClient();

      await expect(client.getSpans(baseParams)).rejects.toThrow('bad json');
    });
  });

  describe('edge cases', () => {
    it('returns lenient validation result when repair is disabled', async () => {
      mockCallModel.mockResolvedValue({ text: '{"spans": []}', metadata: {} });
      mockParseJson.mockReturnValue({
        ok: true,
        value: { spans: [{ text: 'cat', role: 'subject' }], meta: { version: 'v1', notes: '' } },
      });

      mockValidateSpans
        .mockReturnValueOnce({ ok: false, errors: ['bad'], result: { spans: [], meta: { version: 'v1', notes: '' } } })
        .mockReturnValueOnce({
          ok: true,
          errors: [],
          result: { spans: [{ text: 'cat', role: 'subject' }], meta: { version: 'v1', notes: 'lenient' } },
        });

      const client = new RobustLlmClient();
      const result = await client.getSpans(baseParams);

      expect(result.meta.notes).toBe('lenient');
      const secondCallArgs = mockValidateSpans.mock.calls[1]?.[0] as { attempt?: number };
      expect(secondCallArgs.attempt).toBe(2);
    });
  });

  describe('core behavior', () => {
    it('uses repair flow when enabled and validation fails', async () => {
      mockCallModel.mockResolvedValue({ text: '{"spans": []}', metadata: {} });
      mockParseJson.mockReturnValue({
        ok: true,
        value: { spans: [{ text: 'cat', role: 'subject' }], meta: { version: 'v1', notes: '' } },
      });

      mockValidateSpans.mockReturnValue({
        ok: false,
        errors: ['bad'],
        result: { spans: [], meta: { version: 'v1', notes: '' } },
      });

      mockAttemptRepair.mockResolvedValue({
        result: { spans: [{ text: 'repaired', role: 'subject' }], meta: { version: 'v1', notes: 'repaired' } },
        metadata: { averageConfidence: 0.3 },
      });

      const client = new RobustLlmClient();
      const result = await client.getSpans({ ...baseParams, enableRepair: true });

      expect(result.spans[0]?.text).toBe('repaired');
      const metadata = (client as unknown as { _lastResponseMetadata: Record<string, unknown> })._lastResponseMetadata;
      expect(metadata.averageConfidence).toBe(0.3);
    });

    it('uses two-pass extraction for mini models', async () => {
      process.env.SPAN_MODEL = 'gpt-4o-mini-2024-07-18';
      mockTwoPassExtraction.mockResolvedValue({ text: '{"spans": []}', metadata: {} });
      mockParseJson.mockReturnValue({
        ok: true,
        value: { spans: [], meta: { version: 'v1', notes: '' } },
      });
      mockValidateSpans.mockReturnValue({
        ok: true,
        errors: [],
        result: { spans: [], meta: { version: 'v1', notes: '' } },
      });

      const client = new RobustLlmClient();
      await client.getSpans(baseParams);

      expect(mockTwoPassExtraction).toHaveBeenCalled();
      expect(mockCallModel).not.toHaveBeenCalled();
    });
  });
});
