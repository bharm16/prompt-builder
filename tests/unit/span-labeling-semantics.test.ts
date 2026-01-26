import { describe, expect, it, vi, beforeEach } from 'vitest';

const vectorForText = (text: string): number[] => {
  const lower = text.toLowerCase();
  if (/(wave|waving|point|pointing|nod|nodding|clap|clapping|salute|bow)/.test(lower)) {
    return [0, 0, 1, 0];
  }
  if (/(sit|sitting|stand|standing|wait|waiting|rest|resting|gazing|lying)/.test(lower)) {
    return [1, 0, 0, 0];
  }
  if (/(run|running|jump|jumping|dance|walking|swim|swimming|climb|climbing|fly|flying|jog)/.test(lower)) {
    return [0, 1, 0, 0];
  }
  if (/(neon|candle|sunlight|moonlight|streetlight|firelight|window|spotlight)/.test(lower)) {
    return [0, 1, 0, 0];
  }
  if (/(golden hour|twilight|dawn|dusk|midday|midnight|overcast)/.test(lower)) {
    return [0, 0, 0, 1];
  }
  if (/(warm|cool|tungsten|amber|blue|color temperature)/.test(lower)) {
    return [0, 0, 1, 0];
  }
  return [1, 0, 0, 0];
};

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn(async () => async (text: string) => ({
    data: Float32Array.from(vectorForText(text)),
  })),
}));

beforeEach(() => {
  vi.resetModules();
});

describe('LightingSemantics', () => {
  it('classifies lighting phrases into semantic classes', async () => {
    const module = await import('@llm/span-labeling/nlp/LightingSemantics');
    const result = await module.classifyLightingSemantically('neon signs glowing');

    expect(result.lightingClass).toBe('source');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(module.isLightingSemanticsReady()).toBe(true);
  });

  it('maps lighting classes to taxonomy ids', async () => {
    const module = await import('@llm/span-labeling/nlp/LightingSemantics');
    expect(module.lightingClassToTaxonomy('timeOfDay')).toBe('lighting.timeOfDay');
  });
});

describe('VerbSemantics', () => {
  it('falls back to movement for sync classification when model is cold', async () => {
    const module = await import('@llm/span-labeling/nlp/VerbSemantics');
    expect(module.classifyVerbSync('running quickly')).toBe('action.movement');
  });

  it('classifies verbs semantically using embeddings', async () => {
    const module = await import('@llm/span-labeling/nlp/VerbSemantics');
    const result = await module.classifyVerbSemantically('waving hand');
    expect(result.actionClass).toBe('gesture');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(module.isVerbSemanticsReady()).toBe(true);
  });
});
