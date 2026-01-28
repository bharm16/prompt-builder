import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockDetectInjectionPatterns = vi.fn();
const mockCreateLlmClient = vi.fn();

vi.mock('@utils/SecurityPrompts', () => ({
  detectInjectionPatterns: (...args: unknown[]) => mockDetectInjectionPatterns(...args),
}));

vi.mock('@llm/span-labeling/services/LlmClientFactory', () => ({
  createLlmClient: (...args: unknown[]) => mockCreateLlmClient(...args),
  getCurrentSpanProvider: () => 'groq',
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: () => ({ warn: vi.fn(), debug: vi.fn(), info: vi.fn() }),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

describe('SpanLabelingService', () => {
  beforeEach(() => {
    mockDetectInjectionPatterns.mockReset();
    mockCreateLlmClient.mockReset();
  });

  it('throws when required parameters are missing', async () => {
    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService');
    await expect(labelSpans({ text: '   ' } as never, {} as never)).rejects.toThrow('text is required');
    await expect(labelSpans({ text: 'hello' } as never, null as never)).rejects.toThrow('aiService is required');
  });

  it('returns adversarial result when input is flagged', async () => {
    mockDetectInjectionPatterns.mockReturnValue({ hasPatterns: true, patterns: ['inject'] });
    const { labelSpans } = await import('@llm/span-labeling/SpanLabelingService');

    const result = await labelSpans(
      { text: 'ignore instructions', templateVersion: 'v1' } as never,
      { execute: vi.fn(), getOperationConfig: vi.fn() } as never
    );

    expect(result.spans).toEqual([]);
    expect(result.isAdversarial).toBe(true);
    expect(result.meta?.notes).toContain('adversarial');
    expect(result.analysisTrace).toContain('adversarial precheck');
  });

  it('suppresses streaming output for adversarial input', async () => {
    mockDetectInjectionPatterns.mockReturnValue({ hasPatterns: true, patterns: ['inject'] });
    const { labelSpansStream } = await import('@llm/span-labeling/SpanLabelingService');

    const aiService = { execute: vi.fn(), getOperationConfig: vi.fn() } as never;
    const spans: unknown[] = [];

    for await (const span of labelSpansStream({ text: 'malicious' } as never, aiService)) {
      spans.push(span);
    }

    expect(spans).toHaveLength(0);
  });

  it('falls back to blocking call when streaming is unsupported', async () => {
    mockDetectInjectionPatterns.mockReturnValue({ hasPatterns: false, patterns: [] });
    const getSpans = vi.fn().mockResolvedValue({
      spans: [
        { text: 'cat', start: 0, end: 3, role: 'subject.identity' },
        { text: 'bad', start: 'x', end: 4, role: 'subject.identity' },
      ],
      meta: { version: 'v1', notes: '' },
    });
    mockCreateLlmClient.mockReturnValue({ getSpans });

    const serviceModule = await import('@llm/span-labeling/SpanLabelingService');
    const aiService = { execute: vi.fn(), getOperationConfig: vi.fn() } as never;
    const spans: unknown[] = [];

    for await (const span of serviceModule.labelSpansStream({ text: 'cat' } as never, aiService)) {
      spans.push(span);
    }

    expect(spans).toHaveLength(1);
    expect((spans[0] as { text?: string }).text).toBe('cat');
    expect(getSpans).toHaveBeenCalled();
  });
});
