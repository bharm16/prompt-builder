import { describe, it, expect } from 'vitest';
import { TemperatureOptimizer } from '../TemperatureOptimizer';

describe('TemperatureOptimizer', () => {
  describe('error handling', () => {
    it('returns default temperature for unknown task type', () => {
      const result = TemperatureOptimizer.getOptimalTemperature('unknown-task' as never);

      expect(result).toBe(0.5);
    });

    it('handles undefined options gracefully', () => {
      const result = TemperatureOptimizer.getOptimalTemperature('general', undefined);

      expect(result).toBe(0.5);
    });

    it('handles empty options object', () => {
      const result = TemperatureOptimizer.getOptimalTemperature('general', {});

      expect(result).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('clamps temperature to minimum 0.0 when adjustments push below', () => {
      // Classification (0.1) with low diversity (-0.1) and maximum precision (-0.2) = -0.2
      const result = TemperatureOptimizer.getOptimalTemperature('classification', {
        diversity: 'low',
        precision: 'maximum',
      });

      expect(result).toBe(0.0);
    });

    it('clamps temperature to maximum 1.0 when adjustments push above', () => {
      // Brainstorming (0.9) with maximum diversity (+0.2) and low precision (+0.1) = 1.2
      const result = TemperatureOptimizer.getOptimalTemperature('brainstorming', {
        diversity: 'maximum',
        precision: 'low',
      });

      expect(result).toBe(1.0);
    });

    it('handles opposing diversity and precision adjustments', () => {
      // General (0.5) with high diversity (+0.1) and high precision (-0.1) = 0.5
      const result = TemperatureOptimizer.getOptimalTemperature('general', {
        diversity: 'high',
        precision: 'high',
      });

      expect(result).toBe(0.5);
    });
  });

  describe('getOptimalTemperature', () => {
    describe('deterministic tasks (0.0-0.3)', () => {
      it('returns low temperature for classification tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('classification');

        expect(result).toBe(0.1);
      });

      it('returns low temperature for validation tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('validation');

        expect(result).toBe(0.1);
      });

      it('returns low temperature for structured-data tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('structured-data');

        expect(result).toBe(0.1);
      });

      it('returns low temperature for extraction tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('extraction');

        expect(result).toBe(0.15);
      });

      it('returns low temperature for analysis tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('analysis');

        expect(result).toBe(0.2);
      });

      it('returns low temperature for scene-detection tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('scene-detection');

        expect(result).toBe(0.2);
      });
    });

    describe('balanced tasks (0.4-0.6)', () => {
      it('returns moderate temperature for reasoning tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('reasoning');

        expect(result).toBe(0.4);
      });

      it('returns moderate temperature for optimization tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('optimization');

        expect(result).toBe(0.5);
      });

      it('returns moderate temperature for research tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('research');

        expect(result).toBe(0.5);
      });

      it('returns moderate temperature for explanation tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('explanation');

        expect(result).toBe(0.5);
      });

      it('returns moderate temperature for general tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('general');

        expect(result).toBe(0.5);
      });

      it('returns moderate temperature for socratic tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('socratic');

        expect(result).toBe(0.6);
      });

      it('returns moderate temperature for question-generation tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('question-generation');

        expect(result).toBe(0.6);
      });
    });

    describe('creative tasks (0.7-1.0)', () => {
      it('returns high temperature for video-generation tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('video-generation');

        expect(result).toBe(0.7);
      });

      it('returns high temperature for enhancement tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('enhancement');

        expect(result).toBe(0.7);
      });

      it('returns high temperature for rewriting tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('rewriting');

        expect(result).toBe(0.7);
      });

      it('returns high temperature for creative-suggestion tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('creative-suggestion');

        expect(result).toBe(0.8);
      });

      it('returns high temperature for brainstorming tasks', () => {
        const result = TemperatureOptimizer.getOptimalTemperature('brainstorming');

        expect(result).toBe(0.9);
      });
    });

    describe('diversity adjustments', () => {
      it('decreases temperature for low diversity', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { diversity: 'low' });

        expect(result).toBe(base - 0.1);
      });

      it('keeps temperature unchanged for medium diversity', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { diversity: 'medium' });

        expect(result).toBe(base);
      });

      it('increases temperature for high diversity', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { diversity: 'high' });

        expect(result).toBe(base + 0.1);
      });

      it('significantly increases temperature for maximum diversity', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { diversity: 'maximum' });

        expect(result).toBe(base + 0.2);
      });
    });

    describe('precision adjustments', () => {
      it('increases temperature for low precision', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { precision: 'low' });

        expect(result).toBe(base + 0.1);
      });

      it('keeps temperature unchanged for medium precision', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { precision: 'medium' });

        expect(result).toBe(base);
      });

      it('decreases temperature for high precision', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { precision: 'high' });

        expect(result).toBe(base - 0.1);
      });

      it('significantly decreases temperature for maximum precision', () => {
        const base = TemperatureOptimizer.getOptimalTemperature('general');
        const result = TemperatureOptimizer.getOptimalTemperature('general', { precision: 'maximum' });

        expect(result).toBe(base - 0.2);
      });
    });
  });

  describe('getTemperatureConfig', () => {
    it('returns complete configuration object', () => {
      const result = TemperatureOptimizer.getTemperatureConfig('classification');

      expect(result).toHaveProperty('temperature');
      expect(result).toHaveProperty('taskType');
      expect(result).toHaveProperty('rationale');
      expect(result).toHaveProperty('applied');
    });

    it('includes task type in result', () => {
      const result = TemperatureOptimizer.getTemperatureConfig('brainstorming');

      expect(result.taskType).toBe('brainstorming');
    });

    it('includes applied options in result', () => {
      const options = { diversity: 'high' as const, precision: 'low' as const };
      const result = TemperatureOptimizer.getTemperatureConfig('general', options);

      expect(result.applied).toEqual(options);
    });

    it('returns deterministic rationale for low temperatures', () => {
      const result = TemperatureOptimizer.getTemperatureConfig('classification');

      expect(result.rationale).toContain('deterministic');
      expect(result.rationale).toContain('classification');
    });

    it('returns balanced rationale for moderate temperatures', () => {
      const result = TemperatureOptimizer.getTemperatureConfig('general');

      expect(result.rationale).toContain('balanced');
      expect(result.rationale).toContain('general');
    });

    it('returns creative rationale for high temperatures', () => {
      const result = TemperatureOptimizer.getTemperatureConfig('brainstorming');

      expect(result.rationale).toContain('creative');
      expect(result.rationale).toContain('brainstorming');
    });
  });

  describe('recommendTemperature', () => {
    it('returns configuration with recommendations', () => {
      const result = TemperatureOptimizer.recommendTemperature();

      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('uses general task type by default', () => {
      const result = TemperatureOptimizer.recommendTemperature();

      expect(result.taskType).toBe('general');
    });

    it('applies specified task type', () => {
      const result = TemperatureOptimizer.recommendTemperature({ taskType: 'brainstorming' });

      expect(result.taskType).toBe('brainstorming');
    });

    it('sets high diversity when creativity is needed', () => {
      const result = TemperatureOptimizer.recommendTemperature({ needsCreativity: true });
      const baseResult = TemperatureOptimizer.recommendTemperature();

      expect(result.temperature).toBeGreaterThan(baseResult.temperature);
    });

    it('sets high diversity when diversity is needed', () => {
      const result = TemperatureOptimizer.recommendTemperature({ needsDiversity: true });
      const baseResult = TemperatureOptimizer.recommendTemperature();

      expect(result.temperature).toBeGreaterThan(baseResult.temperature);
    });

    it('sets high precision when consistency is needed', () => {
      const result = TemperatureOptimizer.recommendTemperature({ needsConsistency: true });
      const baseResult = TemperatureOptimizer.recommendTemperature();

      expect(result.temperature).toBeLessThan(baseResult.temperature);
    });

    it('sets high precision when precision is needed', () => {
      const result = TemperatureOptimizer.recommendTemperature({ needsPrecision: true });
      const baseResult = TemperatureOptimizer.recommendTemperature();

      expect(result.temperature).toBeLessThan(baseResult.temperature);
    });

    it('provides caching recommendations for low temperatures', () => {
      const result = TemperatureOptimizer.recommendTemperature({
        taskType: 'classification',
        needsPrecision: true,
      });

      expect(result.recommendations?.some((r) => r.toLowerCase().includes('caching'))).toBe(true);
    });

    it('provides variability recommendations for high temperatures', () => {
      const result = TemperatureOptimizer.recommendTemperature({
        taskType: 'brainstorming',
        needsCreativity: true,
      });

      expect(result.recommendations?.some((r) => r.toLowerCase().includes('variability'))).toBe(true);
    });
  });

  describe('getPresets', () => {
    it('returns preset configuration object', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(typeof presets).toBe('object');
      expect(Object.keys(presets).length).toBeGreaterThan(0);
    });

    it('includes fact extraction preset with temperature 0.0', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(presets.factExtraction).toEqual({
        temperature: 0.0,
        description: 'Pure fact extraction',
      });
    });

    it('includes classification preset with low temperature', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(presets.dataClassification?.temperature).toBe(0.1);
    });

    it('includes code generation preset', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(presets.codeGeneration?.temperature).toBe(0.2);
      expect(presets.codeGeneration?.description).toContain('code');
    });

    it('includes general QA preset with moderate temperature', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(presets.generalQA?.temperature).toBe(0.5);
    });

    it('includes brainstorming preset with high temperature', () => {
      const presets = TemperatureOptimizer.getPresets();

      expect(presets.brainstorming?.temperature).toBe(0.9);
    });

    it('all presets have temperature and description', () => {
      const presets = TemperatureOptimizer.getPresets();

      for (const preset of Object.values(presets)) {
        expect(typeof preset.temperature).toBe('number');
        expect(typeof preset.description).toBe('string');
        expect(preset.temperature).toBeGreaterThanOrEqual(0);
        expect(preset.temperature).toBeLessThanOrEqual(1);
      }
    });
  });
});
