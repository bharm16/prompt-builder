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
import { stripPreviewSections } from '@services/image-generation/promptSanitization';
import {
  BASE_PROVIDER,
  EDIT_PROVIDER,
  STORYBOARD_DURATION_SECONDS,
  STORYBOARD_FRAME_COUNT,
  STORYBOARD_FRAME_TIMESTAMPS,
  STORYBOARD_MAX_PARALLEL,
} from '../constants';

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

    it('falls back to original prompt when stripping would remove too much text', () => {
      const prompt = 'Scene\nVariation 1:\nChange angle';
      expect(stripPreviewSections(prompt)).toBe(prompt);
    });
  });

  describe('core behavior', () => {
    it('builds storyboard prompts with the requested delta count', () => {
      const systemPrompt = buildSystemPrompt(3);
      const repairPrompt = buildRepairSystemPrompt(3);
      const editPrompt = buildEditPrompt('base prompt', 'delta prompt');
      const fallbackEditPrompt = buildEditPrompt('base prompt', '   ');

      expect(systemPrompt).toContain('KEYFRAME DESCRIPTIONS');
      expect(systemPrompt).toContain('COMPLETE SCENE DESCRIPTION');
      expect(systemPrompt).toContain('ANTI-PATTERNS');
      expect(systemPrompt).toContain('{"deltas"');
      expect(repairPrompt).toContain('REPAIR MODE');
      expect(editPrompt).toBe('delta prompt');
      expect(fallbackEditPrompt).toBe('base prompt');
    });

    it('cycles fallback deltas and exposes storyboard constants', () => {
      const deltas = buildFallbackDeltas(6);

      expect(deltas).toHaveLength(6);
      expect(deltas[0]).toBe(deltas[3]);
      expect(deltas[1]).toBe(deltas[4]);
      expect(deltas[2]).toBe(deltas[5]);
      expect(resolveChainingUrl({ imageUrl: 'img', providerUrl: 'provider' })).toBe('provider');
      expect(resolveChainingUrl({ imageUrl: 'img' })).toBe('img');
      expect(STORYBOARD_FRAME_COUNT).toBe(4);
      expect(BASE_PROVIDER).toBe('replicate-flux-schnell');
      expect(EDIT_PROVIDER).toBe('replicate-flux-kontext-fast');
      expect(STORYBOARD_DURATION_SECONDS).toBe(4);
      expect(STORYBOARD_FRAME_TIMESTAMPS).toHaveLength(STORYBOARD_FRAME_COUNT);
      expect(STORYBOARD_FRAME_TIMESTAMPS[0]).toBe(0);
      expect(STORYBOARD_FRAME_TIMESTAMPS[STORYBOARD_FRAME_TIMESTAMPS.length - 1]).toBe(
        STORYBOARD_DURATION_SECONDS
      );
      expect(STORYBOARD_MAX_PARALLEL).toBe(3);
    });

    it('strips preview-only sections while preserving the primary scene prompt', () => {
      const prompt = [
        'A runner crossing dunes at sunset.',
        '',
        '**Technical Parameters**',
        '- 35mm lens',
        '',
        'Variation 1:',
        'Lower angle',
      ].join('\n');

      expect(stripPreviewSections(prompt)).toBe('A runner crossing dunes at sunset.');
    });
  });
});
