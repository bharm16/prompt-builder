import { describe, expect, it } from 'vitest';
import {
  MODEL_CATALOG,
  getModelCapabilities,
  getModelDetectionPatterns,
} from '../modelCatalog';
import { CANONICAL_PROMPT_MODEL_IDS } from '../videoModels';

describe('modelCatalog', () => {
  it('includes an entry for every canonical prompt model', () => {
    for (const id of CANONICAL_PROMPT_MODEL_IDS) {
      expect(MODEL_CATALOG[id]).toBeDefined();
    }
  });

  it('includes a Runway entry (recommendation-only model has no generation adapter)', () => {
    const entry = MODEL_CATALOG['runway-gen45'];
    expect(entry).toBeDefined();
    expect(entry.capabilities.qualityTier).toBeDefined();
    expect(entry.detectionPatterns.indicators.test('runway gen 4.5')).toBe(
      true
    );
    expect(entry.detectionPatterns.indicators.test('runway')).toBe(true);
    expect(entry.detectionPatterns.strengths.primary.length).toBeGreaterThan(0);
  });

  it('getModelCapabilities returns numeric capabilities for known ids', () => {
    const caps = getModelCapabilities('sora-2');
    expect(caps).not.toBeNull();
    expect(typeof caps!.physics).toBe('number');
    expect(caps!.qualityTier).toBe('premium');
  });

  it('getModelDetectionPatterns surfaces strengths and optimal params', () => {
    const patterns = getModelDetectionPatterns('luma-ray3');
    expect(patterns).not.toBeNull();
    expect(patterns!.keywords).toContain('luma');
    expect(patterns!.optimalParams).toBeDefined();
    expect(patterns!.strengths.primary.length).toBeGreaterThan(0);
  });

  it('detection regex matches canonical id keywords for each entry', () => {
    // Smoke test: each entry's primary keyword should match its own indicator
    // regex (or at least match through one of its keywords / markers).
    const probeText: Record<string, string> = {
      'runway-gen45': 'runway gen 4.5',
      'luma-ray3': 'luma ray-3',
      'kling-2.1': 'kling 2.1',
      'sora-2': 'sora 2',
      'veo-3': 'google veo 3',
      'wan-2.2': 'wan 2.2',
    };
    for (const id of CANONICAL_PROMPT_MODEL_IDS) {
      const text = probeText[id];
      expect(text).toBeDefined();
      const patterns = MODEL_CATALOG[id].detectionPatterns;
      expect(patterns.indicators.test(text!)).toBe(true);
    }
  });
});
