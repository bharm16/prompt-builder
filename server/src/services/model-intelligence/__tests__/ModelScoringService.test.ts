import { describe, expect, it } from 'vitest';
import { ModelScoringService } from '../services/ModelScoringService';
import { BASE_REQUIREMENTS } from './fixtures/testPrompts';
import type { ModelCapabilities, PromptRequirements } from '../types';
import { VIDEO_MODELS } from '@config/modelConfig';

const baseCapabilities: ModelCapabilities = {
  physics: 0.7,
  particleSystems: 0.7,
  fluidDynamics: 0.7,
  facialPerformance: 0.7,
  bodyLanguage: 0.7,
  characterActing: 0.7,
  cinematicLighting: 0.7,
  atmospherics: 0.7,
  environmentDetail: 0.7,
  architecturalAccuracy: 0.7,
  motionComplexity: 0.7,
  cameraControl: 0.7,
  stylization: 0.7,
  photorealism: 0.7,
  morphing: 0.7,
  transitions: 0.7,
  t2vBoost: 1,
  i2vBoost: 1,
  speedTier: 'medium',
  costTier: 'medium',
  qualityTier: 'standard',
};

const withRequirements = (overrides: Partial<PromptRequirements>): PromptRequirements => ({
  ...BASE_REQUIREMENTS,
  ...overrides,
});

describe('ModelScoringService', () => {
  const service = new ModelScoringService();

  describe('edge cases', () => {
    it('defaults to general quality weights when no requirements match', () => {
      const score = service.scoreModel(VIDEO_MODELS.SORA_2, baseCapabilities, BASE_REQUIREMENTS, 't2v');

      const factors = score.factorScores.map((factor) => factor.factor);
      expect(factors).toContain('photorealism');
      expect(factors).toContain('motionComplexity');
      expect(score.overallScore).toBeGreaterThan(0);
    });

    it('uses default mode boost when boost values are missing', () => {
      const requirements = withRequirements({
        motion: { ...BASE_REQUIREMENTS.motion, hasMorphing: true },
      });
      const capabilitiesWithoutBoost = {
        ...baseCapabilities,
        i2vBoost: undefined,
        t2vBoost: undefined,
      } as unknown as ModelCapabilities;

      const t2vScore = service.scoreModel(
        VIDEO_MODELS.SORA_2,
        capabilitiesWithoutBoost,
        requirements,
        't2v'
      );
      const i2vScore = service.scoreModel(
        VIDEO_MODELS.SORA_2,
        capabilitiesWithoutBoost,
        requirements,
        'i2v'
      );

      expect(i2vScore.overallScore).toBe(t2vScore.overallScore);
    });
  });

  describe('core behavior', () => {
    it('rewards models with higher morphing capability when required', () => {
      const requirements = withRequirements({
        motion: { ...BASE_REQUIREMENTS.motion, hasMorphing: true },
      });

      const highMorph = service.scoreModel(
        VIDEO_MODELS.LUMA_RAY3,
        { ...baseCapabilities, morphing: 0.95 },
        requirements,
        't2v'
      );
      const lowMorph = service.scoreModel(
        VIDEO_MODELS.SORA_2,
        { ...baseCapabilities, morphing: 0.4 },
        requirements,
        't2v'
      );

      expect(highMorph.overallScore).toBeGreaterThan(lowMorph.overallScore);
    });

    it('applies i2v boost modifiers to factor scores', () => {
      const requirements = withRequirements({
        physics: { ...BASE_REQUIREMENTS.physics, hasComplexPhysics: true },
      });
      const capabilities = { ...baseCapabilities, i2vBoost: 0.8, t2vBoost: 1 };

      const t2vScore = service.scoreModel(VIDEO_MODELS.SORA_2, capabilities, requirements, 't2v');
      const i2vScore = service.scoreModel(VIDEO_MODELS.SORA_2, capabilities, requirements, 'i2v');

      expect(i2vScore.overallScore).toBeLessThan(t2vScore.overallScore);
    });

    it('records strengths for high capability factors', () => {
      const requirements = withRequirements({
        style: { ...BASE_REQUIREMENTS.style, isPhotorealistic: true },
      });
      const score = service.scoreModel(
        VIDEO_MODELS.SORA_2,
        { ...baseCapabilities, photorealism: 0.9 },
        requirements,
        't2v'
      );

      expect(score.strengths).toEqual(
        expect.arrayContaining([expect.stringContaining('Photorealism')])
      );
    });

    it('records weaknesses and warnings when weighted capabilities are low', () => {
      const requirements = withRequirements({
        physics: { ...BASE_REQUIREMENTS.physics, hasComplexPhysics: true },
        character: {
          ...BASE_REQUIREMENTS.character,
          requiresFacialPerformance: true,
          emotionalIntensity: 'intense',
        },
        motion: { ...BASE_REQUIREMENTS.motion, hasMorphing: true },
      });

      const score = service.scoreModel(
        VIDEO_MODELS.DRAFT,
        {
          ...baseCapabilities,
          physics: 0.5,
          facialPerformance: 0.5,
          morphing: 0.4,
          characterActing: 0.4,
        },
        requirements,
        't2v'
      );

      expect(score.weaknesses.length).toBeGreaterThan(0);
      expect(score.warnings).toEqual(
        expect.arrayContaining([
          'Physics simulation may be inconsistent',
          'Facial expressions may lack subtlety',
          'Morphing effects may not render smoothly',
        ])
      );
    });
  });
});
