import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@llm/span-labeling/nlp/VerbSemantics', () => ({
  classifyVerbSemantically: vi.fn(async () => ({ actionClass: 'gesture', confidence: 0.9 })),
  isVerbSemanticsReady: () => false,
  warmupVerbSemantics: vi.fn(),
}));

vi.mock('@llm/span-labeling/nlp/LightingSemantics', () => ({
  classifyLightingSemantically: vi.fn(async () => ({ lightingClass: 'quality', confidence: 0.9 })),
  lightingClassToTaxonomy: (cls: string) => `lighting.${cls}`,
  isLightingSemanticsReady: () => true,
  warmupLightingSemantics: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

describe('CompromiseService', () => {
  it('returns empty spans when disabled or invalid input', async () => {
    const { extractActionSpans } = await import('@llm/span-labeling/nlp/CompromiseService');
    const result = await extractActionSpans('', { enabled: false });
    expect(result.spans).toHaveLength(0);
    expect(result.stats.totalExtracted).toBe(0);
  });

  it('extracts action spans from verb phrases', async () => {
    const { extractActionSpans } = await import('@llm/span-labeling/nlp/CompromiseService');
    const result = await extractActionSpans('A dog is running quickly through the park.');

    expect(result.spans.length).toBeGreaterThan(0);
    expect(result.spans[0]?.role).toContain('action');
    expect(result.spans[0]?.source).toBe('compromise');
  });
});

describe('LightingService', () => {
  it('extracts lighting spans and applies semantic taxonomy', async () => {
    const { extractLightingSpans } = await import('@llm/span-labeling/nlp/LightingService');
    const result = await extractLightingSpans('Soft shadows and warm ambient glow fill the room.');

    expect(result.spans.length).toBeGreaterThan(0);
    expect(result.spans[0]?.role).toBe('lighting.quality');
    expect(result.spans[0]?.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('filters out excluded compound phrases', async () => {
    const { extractLightingSpans } = await import('@llm/span-labeling/nlp/LightingService');
    const result = await extractLightingSpans('A traffic light glows above the street.');
    expect(result.spans).toHaveLength(0);
  });

  it('returns empty spans when disabled', async () => {
    const { extractLightingSpans } = await import('@llm/span-labeling/nlp/LightingService');
    const result = await extractLightingSpans('soft shadows', { enabled: false });
    expect(result.spans).toHaveLength(0);
    expect(result.stats.totalExtracted).toBe(0);
  });
});
