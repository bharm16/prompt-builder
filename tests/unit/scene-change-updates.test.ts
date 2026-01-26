import { describe, it, expect } from 'vitest';

import { applySceneChangeUpdates } from '@/utils/sceneChange/sceneChangeUpdates';

describe('sceneChangeUpdates', () => {
  describe('error handling', () => {
    it('returns the original prompt when required fields are missing', () => {
      const prompt = '**Environment**\\n- Location: [Forest]';
      const result = applySceneChangeUpdates(prompt, { Location: 'Desert' }, {});

      expect(result).toBe(prompt);
    });
  });

  describe('edge cases', () => {
    it('escapes special characters in field names and values', () => {
      const prompt = '**Scene**\\n- Camera (type): [Wide+Shot]';
      const result = applySceneChangeUpdates(
        prompt,
        { 'Camera (type)': 'Close-Up' },
        { 'Camera (type)': 'Wide+Shot' }
      );

      expect(result).toContain('[Close-Up]');
      expect(result).not.toContain('[Wide+Shot]');
    });
  });

  describe('core behavior', () => {
    it('updates all affected fields in the prompt', () => {
      const prompt = [
        '**Environment**',
        '- Location: [Forest]',
        '- Weather: [Foggy]',
      ].join('\\n');

      const result = applySceneChangeUpdates(
        prompt,
        { Location: 'Desert', Weather: 'Sunny' },
        { Location: 'Forest', Weather: 'Foggy' }
      );

      expect(result).toContain('[Desert]');
      expect(result).toContain('[Sunny]');
      expect(result).not.toContain('[Forest]');
      expect(result).not.toContain('[Foggy]');
    });
  });
});
