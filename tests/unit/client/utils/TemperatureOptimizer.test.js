import { describe, it, expect } from 'vitest';
import { TemperatureOptimizer } from '../TemperatureOptimizer.js';

describe('TemperatureOptimizer', () => {
  it('returns base temps per task type', () => {
    expect(TemperatureOptimizer.getOptimalTemperature('classification')).toBeCloseTo(0.1, 2);
    expect(TemperatureOptimizer.getOptimalTemperature('optimization')).toBeCloseTo(0.5, 2);
    expect(TemperatureOptimizer.getOptimalTemperature('creative-suggestion')).toBeGreaterThan(0.7);
  });

  it('applies diversity and precision adjustments and clamps to [0,1]', () => {
    const highDiv = TemperatureOptimizer.getOptimalTemperature('analysis', { diversity: 'maximum' });
    expect(highDiv).toBeGreaterThan(0.2);
    const hiPrecision = TemperatureOptimizer.getOptimalTemperature('brainstorming', { precision: 'maximum' });
    expect(hiPrecision).toBeLessThanOrEqual(1.0);
    expect(hiPrecision).toBeLessThan(TemperatureOptimizer.getOptimalTemperature('brainstorming'));
  });

  it('recommendTemperature maps flags to config', () => {
    const cfg = TemperatureOptimizer.recommendTemperature({ needsCreativity: true, needsPrecision: false, taskType: 'general' });
    expect(cfg.temperature).toBeGreaterThanOrEqual(0.5);
    expect(Array.isArray(cfg.recommendations)).toBe(true);
  });

  it('presets are exposed and sane', () => {
    const presets = TemperatureOptimizer.getPresets();
    expect(presets).toHaveProperty('factExtraction');
    expect(presets.codeGeneration.temperature).toBeLessThanOrEqual(0.2);
  });
});

