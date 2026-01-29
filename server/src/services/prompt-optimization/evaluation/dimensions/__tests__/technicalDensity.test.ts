import { describe, it, expect } from 'vitest';
import { evaluateTechnicalDensity, getTechnicalTerms } from '../technicalDensity';

describe('evaluateTechnicalDensity', () => {
  describe('edge cases', () => {
    it('returns 0.3 for empty string (0 terms)', () => {
      expect(evaluateTechnicalDensity('')).toBe(0.3);
    });

    it('returns 0.3 for text with no technical terms', () => {
      expect(evaluateTechnicalDensity('A cat sits on a table')).toBe(0.3);
    });
  });

  describe('boundary values', () => {
    it('returns 0.7 for exactly 1 technical term', () => {
      expect(evaluateTechnicalDensity('A close-up of a cat')).toBe(0.7);
    });

    it('returns 1.0 for exactly 2 technical terms (lower ideal boundary)', () => {
      expect(evaluateTechnicalDensity('A close-up shot with bokeh background')).toBe(1.0);
    });

    it('returns 1.0 for exactly 5 technical terms (upper ideal boundary)', () => {
      expect(evaluateTechnicalDensity(
        'A close-up tracking shot with bokeh and golden hour lighting using handheld camera'
      )).toBe(1.0);
    });

    it('returns 0.7 for 6 technical terms', () => {
      expect(evaluateTechnicalDensity(
        'A close-up tracking shot with bokeh, golden hour, handheld camera, and slow motion'
      )).toBe(0.7);
    });

    it('returns 0.7 for exactly 7 technical terms (upper extended boundary)', () => {
      expect(evaluateTechnicalDensity(
        'A close-up tracking shot with bokeh, golden hour, handheld, slow motion, and depth of field'
      )).toBe(0.7);
    });

    it('returns 0.3 for more than 7 technical terms (over-dense)', () => {
      expect(evaluateTechnicalDensity(
        'close-up tracking pan tilt dolly push-in pull-back bokeh golden hour handheld'
      )).toBe(0.3);
    });
  });

  describe('core behavior', () => {
    it('is case-insensitive', () => {
      expect(evaluateTechnicalDensity('CLOSE-UP with BOKEH effect')).toBe(1.0);
    });

    it('matches multi-word terms like "depth of field"', () => {
      expect(evaluateTechnicalDensity('Filmed with shallow depth of field and close-up framing')).toBe(1.0);
    });
  });
});

describe('getTechnicalTerms', () => {
  it('returns a new array (not the internal reference)', () => {
    const terms1 = getTechnicalTerms();
    const terms2 = getTechnicalTerms();
    expect(terms1).not.toBe(terms2);
    expect(terms1).toEqual(terms2);
  });

  it('includes known technical terms', () => {
    const terms = getTechnicalTerms();
    expect(terms).toContain('close-up');
    expect(terms).toContain('bokeh');
    expect(terms).toContain('golden hour');
    expect(terms).toContain('anamorphic');
  });

  it('returns more than 20 terms', () => {
    expect(getTechnicalTerms().length).toBeGreaterThan(20);
  });
});
