import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  buildSystemPrompt,
  buildRepairSystemPrompt,
  buildEditPrompt,
  buildFallbackDeltas,
} from '../prompts';
import {
  normalizeSeedImageUrl,
  resolveChainingUrl,
  computeSeedBase,
  computeEditSeed,
} from '../storyboardUtils';
import { BASE_PROVIDER, EDIT_PROVIDER, STORYBOARD_FRAME_COUNT } from '../constants';

describe('storyboard helpers', () => {
  describe('error handling', () => {
    it('returns undefined for non-string seed image URLs', () => {
      expect(normalizeSeedImageUrl(undefined)).toBeUndefined();
      expect(normalizeSeedImageUrl(null as any)).toBeUndefined();
    });

    it('returns undefined for non-finite seed values', () => {
      expect(computeSeedBase(Number.NaN)).toBeUndefined();
      expect(computeSeedBase(Number.POSITIVE_INFINITY)).toBeUndefined();
    });

    it('returns an empty fallback list when expected count is non-positive', () => {
      expect(buildFallbackDeltas(0)).toEqual([]);
      expect(buildFallbackDeltas(-2)).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns undefined edit seeds when the base is undefined', () => {
      expect(computeEditSeed(undefined, 2)).toBeUndefined();
    });

    it('normalizes seed image URLs by trimming whitespace', () => {
      fc.assert(
        fc.property(fc.string(), (value) => {
          const result = normalizeSeedImageUrl(value);
          const trimmed = value.trim();
          if (trimmed.length === 0) {
            expect(result).toBeUndefined();
          } else {
            expect(result).toBe(trimmed);
          }
        })
      );
    });
  });

  describe('core behavior', () => {
    it('builds storyboard prompts with the requested delta count', () => {
      const systemPrompt = buildSystemPrompt(3);
      const repairPrompt = buildRepairSystemPrompt(3);
      const editPrompt = buildEditPrompt('base prompt', 'delta prompt');

      expect(systemPrompt).toContain('Return exactly 3 edit instructions');
      expect(systemPrompt).toContain('{"deltas"');
      expect(repairPrompt).toContain('REPAIR MODE');
      expect(editPrompt).toBe('base prompt. delta prompt');
    });

    it('cycles fallback deltas and exposes storyboard constants', () => {
      const deltas = buildFallbackDeltas(6);

      expect(deltas).toHaveLength(6);
      expect(deltas[0]).toBe(deltas[5]);
      expect(resolveChainingUrl({ imageUrl: 'img', providerUrl: 'provider' })).toBe('provider');
      expect(resolveChainingUrl({ imageUrl: 'img' })).toBe('img');
      expect(STORYBOARD_FRAME_COUNT).toBe(4);
      expect(BASE_PROVIDER).toBe('replicate-flux-schnell');
      expect(EDIT_PROVIDER).toBe('replicate-flux-kontext-fast');
    });
  });
});
