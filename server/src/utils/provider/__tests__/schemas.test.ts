import { beforeEach, describe, expect, it, vi } from 'vitest';

const { detectAndGetCapabilitiesMock } = vi.hoisted(() => ({
  detectAndGetCapabilitiesMock: vi.fn(),
}));

vi.mock('@utils/provider/ProviderDetector', () => ({
  detectAndGetCapabilities: detectAndGetCapabilitiesMock,
}));

vi.mock('@llm/span-labeling/schemas/SpanLabelingSchema', () => ({
  OPENAI_SPAN_LABELING_JSON_SCHEMA: { name: 'openai-span', strict: true, type: 'object' },
  GROQ_SPAN_LABELING_JSON_SCHEMA: { name: 'groq-span', type: 'object' },
}));

vi.mock('@llm/span-labeling/schemas/GeminiSchema', () => ({
  GEMINI_JSON_SCHEMA: { name: 'gemini-span', type: 'object' },
}));

import { getCustomSuggestionSchema } from '../schemas/customSuggestion';
import { getEnhancementSchema } from '../schemas/enhancement';
import { getShotInterpreterSchema } from '../schemas/shotInterpreter';
import { getSpanLabelingSchema } from '../schemas/spanLabeling';
import { buildCapabilityOptions } from '../schemas/types';
import { getVideoOptimizationSchema } from '../schemas/videoOptimization';

describe('provider schema factories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('buildCapabilityOptions applies fallback operation and provider mapping', () => {
    const options = buildCapabilityOptions({ provider: 'groq', model: 'm1' }, 'fallback_op');

    expect(options).toEqual({
      operation: 'fallback_op',
      model: 'm1',
      client: 'groq',
    });
  });

  it('returns strict enhancement schema for strict-json providers', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'openai',
      capabilities: { strictJsonSchema: true },
    });

    const schema = getEnhancementSchema();
    expect(schema.strict).toBe(true);
    expect(schema.name).toBe('enhancement_suggestions');
  });

  it('returns non-strict enhancement schema for non-strict providers', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'groq',
      capabilities: { strictJsonSchema: false },
    });

    const schema = getEnhancementSchema();
    expect(schema.strict).toBeUndefined();
    expect(schema.type).toBe('object');
  });

  it('returns provider-specific span labeling schemas', () => {
    detectAndGetCapabilitiesMock.mockReturnValueOnce({
      provider: 'gemini',
      capabilities: { strictJsonSchema: false },
    });
    const gemini = getSpanLabelingSchema();
    expect(gemini.name).toBe('gemini-span');

    detectAndGetCapabilitiesMock.mockReturnValueOnce({
      provider: 'openai',
      capabilities: { strictJsonSchema: true },
    });
    const openai = getSpanLabelingSchema();
    expect(openai.name).toBe('openai-span');
  });

  it('builds strict shot interpreter schema when strict mode is available', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'openai',
      capabilities: { strictJsonSchema: true },
    });

    const schema = getShotInterpreterSchema();
    expect(schema.strict).toBe(true);
    expect(schema.name).toBe('shot_plan');
  });

  it('returns object-wrapper schemas for custom and video operations', () => {
    detectAndGetCapabilitiesMock.mockReturnValue({
      provider: 'groq',
      capabilities: { strictJsonSchema: false },
    });

    const custom = getCustomSuggestionSchema();
    const video = getVideoOptimizationSchema();

    expect(custom.type).toBe('object');
    expect(video.type).toBe('object');
    expect(custom.required).toContain('suggestions');
    expect(video.required).toContain('technical_specs');
  });
});
