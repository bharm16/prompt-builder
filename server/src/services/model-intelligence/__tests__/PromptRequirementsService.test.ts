import { describe, expect, it } from 'vitest';
import { PromptRequirementsService } from '../services/PromptRequirementsService';
import { BASE_REQUIREMENTS, SAMPLE_PROMPT, SAMPLE_SPANS } from './fixtures/testPrompts';
import type { PromptSpan } from '../types';

describe('PromptRequirementsService', () => {
  const service = new PromptRequirementsService();

  describe('edge cases', () => {
    it('uses category when role is missing', () => {
      const spans: PromptSpan[] = [{ text: 'neon city', category: 'environment.urban' }];

      const result = service.extractRequirements('neon city', spans);

      expect(result.detectedCategories).toContain('environment.urban');
      expect(result.environment.hasUrbanElements).toBe(true);
    });

    it('falls back to prompt text when spans are empty', () => {
      const result = service.extractRequirements('A dog running through rain', []);

      expect(result.physics.hasParticleSystems).toBe(true);
      expect(result.character.hasAnimalCharacter).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('derives requirements from role-based spans', () => {
      const result = service.extractRequirements(SAMPLE_PROMPT, SAMPLE_SPANS);

      expect(result.physics.hasParticleSystems).toBe(true);
      expect(result.character.hasMechanicalCharacter).toBe(true);
      expect(result.environment.hasUrbanElements).toBe(true);
      expect(result.lighting.requirements).toBe('dramatic');
    });

    it('keeps baseline values when no cues are present', () => {
      const result = service.extractRequirements('plain scene', []);

      expect(result.physics.physicsComplexity).toBe(BASE_REQUIREMENTS.physics.physicsComplexity);
      expect(result.style.isStylized).toBe(false);
      expect(result.motion.cameraComplexity).toBe('static');
    });
  });
});
