import { describe, expect, it } from 'vitest';
import {
  validateCompareRequest,
  validateEvaluateRequest,
  validateSingleEvaluationRequest,
} from '@routes/suggestions/validators';

const baseContext = {
  highlightedText: 'runner in rain',
  fullPrompt: 'A runner in rain under neon signs.',
  isVideoPrompt: true,
};

describe('suggestions validators', () => {
  describe('validateEvaluateRequest', () => {
    it('accepts trimmed suggestion text within 3-300 chars', () => {
      const result = validateEvaluateRequest({
        suggestions: [{ text: '  Add shallow depth of field  ' }],
        context: baseContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.suggestions).toHaveLength(1);
      }
    });

    it('rejects whitespace-only suggestion text', () => {
      const result = validateEvaluateRequest({
        suggestions: [{ text: '   ' }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('suggestions[0]');
      }
    });

    it('rejects placeholder-like suggestion text', () => {
      const result = validateEvaluateRequest({
        suggestions: [{ text: 'TBD' }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.toLowerCase()).toContain('placeholder');
      }
    });

    it('rejects suggestion text shorter than 3 chars after trim', () => {
      const result = validateEvaluateRequest({
        suggestions: [{ text: ' ok ' }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('3');
      }
    });

    it('rejects suggestion text longer than 300 chars after trim', () => {
      const result = validateEvaluateRequest({
        suggestions: [{ text: 'a'.repeat(301) }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('300');
      }
    });
  });

  describe('validateSingleEvaluationRequest', () => {
    it('accepts valid single suggestion text', () => {
      const result = validateSingleEvaluationRequest({
        suggestion: 'Introduce rim lighting for separation',
        context: baseContext,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.suggestion).toBe('Introduce rim lighting for separation');
      }
    });

    it('rejects placeholder single suggestion text', () => {
      const result = validateSingleEvaluationRequest({
        suggestion: 'placeholder',
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message.toLowerCase()).toContain('placeholder');
      }
    });
  });

  describe('validateCompareRequest', () => {
    it('rejects invalid suggestion text in setA', () => {
      const result = validateCompareRequest({
        setA: [{ text: '  ' }],
        setB: [{ text: 'Add dolly movement for momentum' }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('setA[0]');
      }
    });

    it('rejects invalid suggestion text in setB', () => {
      const result = validateCompareRequest({
        setA: [{ text: 'Add dolly movement for momentum' }],
        setB: [{ text: '[insert suggestion]' }],
        context: baseContext,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.message).toContain('setB[0]');
      }
    });
  });
});
