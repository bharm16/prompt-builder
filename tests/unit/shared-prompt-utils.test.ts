/**
 * Unit tests for SharedPrompt promptUtils
 */

import { describe, expect, it } from 'vitest';

import { getModeLabel } from '@components/SharedPrompt/utils/promptUtils';

describe('getModeLabel', () => {
  describe('edge cases', () => {
    it('returns Unknown when mode is missing', () => {
      expect(getModeLabel(undefined)).toBe('Unknown');
    });

    it('returns the raw mode when not recognized', () => {
      expect(getModeLabel('custom-mode')).toBe('custom-mode');
    });
  });

  describe('core behavior', () => {
    it('maps known modes to labels', () => {
      expect(getModeLabel('optimize')).toBe('Standard Prompt');
      expect(getModeLabel('reasoning')).toBe('Reasoning Prompt');
      expect(getModeLabel('research')).toBe('Deep Research');
      expect(getModeLabel('socratic')).toBe('Socratic Learning');
      expect(getModeLabel('video')).toBe('Video Prompt');
    });
  });
});
