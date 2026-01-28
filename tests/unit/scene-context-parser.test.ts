import { describe, it, expect } from 'vitest';

import { extractSceneContext } from '@/utils/sceneChange/sceneContextParser';

describe('sceneContextParser', () => {
  describe('error handling', () => {
    it('returns defaults when the prompt is missing', () => {
      const result = extractSceneContext(null, 'forest');

      expect(result).toEqual({
        changedField: 'Unknown Field',
        affectedFields: {},
        sectionHeading: null,
        sectionContext: null,
      });
    });
  });

  describe('edge cases', () => {
    it('falls back to the first section when the target is not found', () => {
      const prompt = [
        '**Environment**',
        '- Location: [Forest]',
        '- Weather: [Foggy]',
        '',
        '**Lighting**',
        '- Time: [Golden hour]',
      ].join('\\n');

      const result = extractSceneContext(prompt, 'desert');

      expect(result.sectionHeading).toBe('Environment');
      expect(result.affectedFields).toEqual({
        Location: 'Forest',
        Weather: 'Foggy',
      });
      expect(result.changedField).toBe('Unknown Field');
    });
  });

  describe('core behavior', () => {
    it('extracts the matching section and affected fields', () => {
      const prompt = [
        '**Environment**',
        '- Location: [Forest]',
        '- Weather: [Foggy]',
        '',
        '**Lighting**',
        '- Time: [Golden hour]',
      ].join('\\n');

      const result = extractSceneContext(prompt, 'Forest');

      expect(result.sectionHeading).toBe('Environment');
      expect(result.sectionContext).toContain('- Location: [Forest]');
      expect(result.affectedFields.Location).toBe('Forest');
      expect(result.changedField).toBe('Location');
    });
  });
});
