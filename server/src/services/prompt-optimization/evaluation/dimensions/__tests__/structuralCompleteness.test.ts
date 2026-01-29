import { describe, it, expect } from 'vitest';
import { evaluateStructuralCompleteness } from '../structuralCompleteness';

// Minimal LLMSpan factory — only `role` and `text` are required
const span = (role: string) => ({ role, text: role } as { role: string; text: string });

describe('evaluateStructuralCompleteness', () => {
  describe('edge cases', () => {
    it('returns 0 for empty spans array', () => {
      expect(evaluateStructuralCompleteness([])).toBe(0);
    });

    it('returns 0 for null/undefined input', () => {
      expect(evaluateStructuralCompleteness(null as never)).toBe(0);
      expect(evaluateStructuralCompleteness(undefined as never)).toBe(0);
    });

    it('returns 0 for spans with empty roles', () => {
      expect(evaluateStructuralCompleteness([span(''), span('')])).toBe(0);
    });

    it('handles spans with undefined role', () => {
      expect(evaluateStructuralCompleteness([
        { role: undefined, text: '' } as never,
      ])).toBe(0);
    });
  });

  describe('partial completeness scoring', () => {
    it('returns 0.25 for only subject present', () => {
      expect(evaluateStructuralCompleteness([span('subject.person')])).toBe(0.25);
    });

    it('returns 0.25 for only action present', () => {
      expect(evaluateStructuralCompleteness([span('action.walk')])).toBe(0.25);
    });

    it('returns 0.25 for only environment present', () => {
      expect(evaluateStructuralCompleteness([span('environment.outdoor')])).toBe(0.25);
    });

    it('returns 0.25 for only camera present', () => {
      expect(evaluateStructuralCompleteness([span('camera.tracking')])).toBe(0.25);
    });

    it('returns 0.25 for only lighting present', () => {
      expect(evaluateStructuralCompleteness([span('lighting.golden_hour')])).toBe(0.25);
    });

    it('returns 0.25 for only shot present', () => {
      expect(evaluateStructuralCompleteness([span('shot.closeup')])).toBe(0.25);
    });

    it('returns 0.5 for subject + action', () => {
      expect(evaluateStructuralCompleteness([
        span('subject.person'),
        span('action.walk'),
      ])).toBe(0.5);
    });

    it('returns 0.75 for subject + action + environment', () => {
      expect(evaluateStructuralCompleteness([
        span('subject.person'),
        span('action.walk'),
        span('environment.outdoor'),
      ])).toBe(0.75);
    });
  });

  describe('core behavior', () => {
    it('returns 1.0 for all four categories present', () => {
      expect(evaluateStructuralCompleteness([
        span('subject.person'),
        span('action.walk'),
        span('environment.outdoor'),
        span('camera.tracking'),
      ])).toBe(1.0);
    });

    it('extracts parent category from dotted role string', () => {
      expect(evaluateStructuralCompleteness([
        span('subject.person.adult'),
        span('action.run.fast'),
        span('environment.indoor.studio'),
        span('lighting.dramatic'),
      ])).toBe(1.0);
    });

    it('counts camera, lighting, and shot as interchangeable for 4th category', () => {
      const base = [
        span('subject.person'),
        span('action.walk'),
        span('environment.outdoor'),
      ];
      expect(evaluateStructuralCompleteness([...base, span('camera.pan')])).toBe(1.0);
      expect(evaluateStructuralCompleteness([...base, span('lighting.soft')])).toBe(1.0);
      expect(evaluateStructuralCompleteness([...base, span('shot.wide')])).toBe(1.0);
    });

    it('does not double-count duplicate parent categories', () => {
      expect(evaluateStructuralCompleteness([
        span('subject.person'),
        span('subject.animal'),
        span('subject.object'),
      ])).toBe(0.25);
    });
  });
});
