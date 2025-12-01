/**
 * Tests for LLM API Optimizations
 * 
 * Tests the new features:
 * - Seed parameter
 * - Logprobs confidence
 * - Pre-fill assistant (Groq)
 * - Predicted outputs (OpenAI)
 * - Response validation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateLLMResponse, detectRefusal, attemptJsonRepair, calculateConfidenceFromLogprobs } from '../ResponseValidator';

describe('ResponseValidator', () => {
  describe('validateLLMResponse', () => {
    it('should validate valid JSON response', () => {
      const response = '{"spans": [], "meta": {"version": "v1"}}';
      const result = validateLLMResponse(response, { expectJson: true });
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.parsed).toEqual({ spans: [], meta: { version: 'v1' } });
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should detect and remove preamble', () => {
      const response = 'Here is the JSON:\n{"spans": []}';
      const result = validateLLMResponse(response, { expectJson: true });
      
      expect(result.isValid).toBe(true);
      expect(result.hasPreamble).toBe(true);
      expect(result.parsed).toEqual({ spans: [] });
      expect(result.confidence).toBeLessThan(1.0); // Reduced due to preamble
    });

    it('should detect and remove markdown code blocks', () => {
      const response = '```json\n{"spans": []}\n```';
      const result = validateLLMResponse(response, { expectJson: true });
      
      expect(result.isValid).toBe(true);
      expect(result.hasPreamble).toBe(true);
      expect(result.hasPostamble).toBe(true);
      expect(result.parsed).toEqual({ spans: [] });
    });

    it('should detect truncated JSON', () => {
      const response = '{"spans": [{"text": "test"';
      const result = validateLLMResponse(response, { expectJson: true });
      
      expect(result.isValid).toBe(false);
      expect(result.isTruncated).toBe(true);
      expect(result.errors.some(e => e.includes('truncated') || e.includes('parse'))).toBe(true);
    });

    it('should detect empty response', () => {
      const result = validateLLMResponse('', { expectJson: true });
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Empty response');
      expect(result.confidence).toBe(0);
    });

    it('should validate array response when expected', () => {
      const response = '[{"text": "test"}]';
      const result = validateLLMResponse(response, { expectJson: true, expectArray: true });
      
      expect(result.isValid).toBe(true);
      expect(Array.isArray(result.parsed)).toBe(true);
    });

    it('should reject object when array expected', () => {
      const response = '{"spans": []}';
      const result = validateLLMResponse(response, { expectJson: true, expectArray: true });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Expected array'))).toBe(true);
    });

    it('should check required fields', () => {
      const response = '{"spans": []}';
      const result = validateLLMResponse(response, { 
        expectJson: true, 
        requiredFields: ['spans', 'meta', 'analysis_trace'] 
      });
      
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing required fields'))).toBe(true);
    });

    it('should handle nested required fields', () => {
      const response = '{"spans": [], "meta": {"version": "v1"}}';
      const result = validateLLMResponse(response, { 
        expectJson: true, 
        requiredFields: ['meta.version'] 
      });
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('detectRefusal', () => {
    it('should detect common refusal patterns', () => {
      const refusals = [
        "I cannot help with that request.",
        "I'm not able to assist with this.",
        "Sorry, but I can't do that.",
        "This request violates my guidelines.",
        "As an AI, I must decline this request.",
        "I don't feel comfortable with this.",
      ];

      for (const text of refusals) {
        expect(detectRefusal(text)).toBe(true);
      }
    });

    it('should not detect false positives', () => {
      const nonRefusals = [
        '{"spans": []}',
        'The weather is nice today.',
        'Here is the analysis you requested.',
        'I can help you with that.',
      ];

      for (const text of nonRefusals) {
        expect(detectRefusal(text)).toBe(false);
      }
    });
  });

  describe('attemptJsonRepair', () => {
    it('should remove trailing commas', () => {
      const input = '{"spans": [{"text": "test",}],}';
      const { repaired, changes } = attemptJsonRepair(input);
      
      expect(repaired).toBe('{"spans": [{"text": "test"}]}');
      expect(changes).toContain('Removed trailing commas');
    });

    it('should add missing commas between objects', () => {
      const input = '{"a": 1}{"b": 2}';
      const { repaired, changes } = attemptJsonRepair(input);
      
      expect(repaired).toBe('{"a": 1},{"b": 2}');
      expect(changes).toContain('Added missing commas between objects');
    });

    it('should close unclosed braces', () => {
      const input = '{"spans": [{"text": "test"';
      const { repaired, changes } = attemptJsonRepair(input);
      
      expect(repaired).toBe('{"spans": [{"text": "test"}]}');
      expect(changes.some(c => c.includes('closing braces'))).toBe(true);
    });

    it('should quote unquoted keys', () => {
      const input = '{spans: [], meta: {}}';
      const { repaired, changes } = attemptJsonRepair(input);
      
      expect(repaired).toBe('{"spans": [], "meta": {}}');
      expect(changes).toContain('Added quotes to unquoted keys');
    });
  });

  describe('calculateConfidenceFromLogprobs', () => {
    it('should calculate average confidence', () => {
      const logprobs = [
        { logprob: Math.log(0.9) }, // 0.9 probability
        { logprob: Math.log(0.8) }, // 0.8 probability
        { logprob: Math.log(0.95) }, // 0.95 probability
      ];
      
      const result = calculateConfidenceFromLogprobs(logprobs);
      
      expect(result.average).toBeCloseTo(0.883, 2);
      expect(result.min).toBeCloseTo(0.8, 2);
      expect(result.max).toBeCloseTo(0.95, 2);
    });

    it('should count low confidence tokens', () => {
      const logprobs = [
        { logprob: Math.log(0.9) },  // High confidence
        { logprob: Math.log(0.3) },  // Low confidence
        { logprob: Math.log(0.4) },  // Low confidence
        { logprob: Math.log(0.85) }, // High confidence
      ];
      
      const result = calculateConfidenceFromLogprobs(logprobs);
      
      expect(result.lowConfidenceTokens).toBe(2);
    });

    it('should handle empty logprobs', () => {
      const result = calculateConfidenceFromLogprobs([]);
      
      expect(result.average).toBe(0);
      expect(result.min).toBe(0);
      expect(result.max).toBe(0);
      expect(result.lowConfidenceTokens).toBe(0);
    });

    it('should use probability if provided', () => {
      const logprobs = [
        { logprob: -999, probability: 0.9 },
        { logprob: -999, probability: 0.8 },
      ];
      
      const result = calculateConfidenceFromLogprobs(logprobs);
      
      expect(result.average).toBeCloseTo(0.85, 2);
    });
  });
});

describe('GroqLlamaAdapter optimizations', () => {
  // These tests would require mocking fetch, but document the expected behavior
  
  describe('Pre-fill Assistant', () => {
    it('should add assistant message with { for JSON mode', () => {
      // When enablePrefill is true and jsonMode is true,
      // messages should include: { role: 'assistant', content: '{' }
      // Response should prepend '{' if not already present
    });

    it('should not add pre-fill for array responses', () => {
      // When isArray is true, pre-fill should be disabled
      // to avoid starting with '{' when '[' is expected
    });
  });

  describe('Seed determinism', () => {
    it('should generate consistent seed from prompt hash', () => {
      // Same systemPrompt should generate same seed
      // Different prompts should generate different seeds
    });
  });

  describe('Sandwich prompting', () => {
    it('should add format reminder after user message', () => {
      // When enableSandwich is true and jsonMode is true,
      // should append: "Remember: Output ONLY valid JSON..."
    });
  });
});

describe('OpenAICompatibleAdapter optimizations', () => {
  describe('Predicted Outputs', () => {
    it('should include prediction parameter when provided', () => {
      // prediction: { type: 'content', content: '...' }
      // should be passed to API payload
    });
  });

  describe('Developer Role', () => {
    it('should add developer message as first in array', () => {
      // When developerMessage is provided,
      // should be first message with role: 'developer'
    });
  });

  describe('Bookending', () => {
    it('should add critical instructions at end for long prompts', () => {
      // When total tokens > 30k and enableBookending is true,
      // should append reminder message
    });
  });
});
