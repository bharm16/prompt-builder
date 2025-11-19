import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResilientGenerationService } from '../ResilientGenerationService.js';
import { GRAMMATICAL_CONFIG } from '../../config/grammaticalAnalysis.js';

describe('ResilientGenerationService', () => {
  let service;
  let mockLlmClient;
  let mockPromptBuilder;

  beforeEach(() => {
    // Mock LLM client
    mockLlmClient = {
      complete: vi.fn(),
    };

    // Mock prompt builder
    mockPromptBuilder = {
      buildRewritePrompt: vi.fn(() => 'Base system prompt'),
    };

    service = new ResilientGenerationService(mockLlmClient, mockPromptBuilder, GRAMMATICAL_CONFIG);
  });

  describe('generate', () => {
    it('should return suggestions on first attempt if valid', async () => {
      const params = {
        highlightedText: 'running swiftly',
        contextBefore: 'The athlete was ',
        contextAfter: ' down the track',
        fullPrompt: 'Test prompt',
        originalUserPrompt: 'Test',
        isVideoPrompt: false,
      };

      const analysis = {
        structure: 'gerund_phrase',
        complexity: 0.7,
        tense: 'neutral',
        isPlural: false,
      };

      // Mock successful response
      const mockSuggestions = [
        { text: 'sprinting rapidly', explanation: 'More intense action' },
        { text: 'dashing quickly', explanation: 'Alternative movement' },
      ];

      // Mock StructuredOutputEnforcer via the client
      vi.mock('../../../utils/StructuredOutputEnforcer.js', () => ({
        StructuredOutputEnforcer: {
          enforceJSON: vi.fn(() => Promise.resolve(mockSuggestions)),
        },
      }));

      const result = await service.generate(params, analysis, 3);

      expect(result).toBeTruthy();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should retry on validation failure', async () => {
      const params = {
        highlightedText: 'running swiftly',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'Test',
        originalUserPrompt: 'Test',
        isVideoPrompt: false,
      };

      const analysis = {
        structure: 'gerund_phrase',
        complexity: 0.7,
        tense: 'neutral',
        isPlural: false,
      };

      // First attempt returns invalid (not a gerund)
      // Second attempt returns valid
      const mockInvalidSuggestion = [{ text: 'he sprinted fast', explanation: 'Test' }];
      const mockValidSuggestion = [{ text: 'sprinting rapidly', explanation: 'Test' }];

      let callCount = 0;
      vi.mock('../../../utils/StructuredOutputEnforcer.js', () => ({
        StructuredOutputEnforcer: {
          enforceJSON: vi.fn(() => {
            callCount++;
            return Promise.resolve(callCount === 1 ? mockInvalidSuggestion : mockValidSuggestion);
          }),
        },
      }));

      const result = await service.generate(params, analysis, 3);

      // Should succeed after retry
      expect(result).toBeTruthy();
    });

    it('should return null after max retries exhausted', async () => {
      const params = {
        highlightedText: 'running swiftly',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'Test',
        originalUserPrompt: 'Test',
        isVideoPrompt: false,
      };

      const analysis = {
        structure: 'gerund_phrase',
        complexity: 0.7,
        tense: 'neutral',
        isPlural: false,
      };

      // Always return invalid suggestions
      vi.mock('../../../utils/StructuredOutputEnforcer.js', () => ({
        StructuredOutputEnforcer: {
          enforceJSON: vi.fn(() =>
            Promise.resolve([{ text: 'invalid structure', explanation: 'Test' }])
          ),
        },
      }));

      const result = await service.generate(params, analysis, 2);

      expect(result).toBeNull();
    });
  });

  describe('_calculateRetryParams', () => {
    it('should decrease temperature on each retry', () => {
      const params1 = service._calculateRetryParams(0, 3);
      const params2 = service._calculateRetryParams(1, 3);
      const params3 = service._calculateRetryParams(2, 3);

      expect(params1.temperature).toBeGreaterThan(params2.temperature);
      expect(params2.temperature).toBeGreaterThan(params3.temperature);
    });

    it('should increase strictness on each retry', () => {
      const params1 = service._calculateRetryParams(0, 3);
      const params2 = service._calculateRetryParams(1, 3);
      const params3 = service._calculateRetryParams(2, 3);

      expect(params1.strictness).toBeLessThan(params2.strictness);
      expect(params2.strictness).toBeLessThan(params3.strictness);
    });

    it('should use harmonic decay for temperature', () => {
      const params = service._calculateRetryParams(0, 3);
      
      // First attempt should be ~0.9
      expect(params.temperature).toBeCloseTo(0.9, 1);
    });

    it('should use linear ramp for strictness', () => {
      const params1 = service._calculateRetryParams(0, 3);
      const params3 = service._calculateRetryParams(3, 3);

      // Should start at 0.5 and reach 1.0
      expect(params1.strictness).toBeCloseTo(0.5, 1);
      expect(params3.strictness).toBeCloseTo(1.0, 1);
    });
  });

  describe('_validateStructure', () => {
    it('should validate gerund phrase structure correctly', () => {
      const analysis = {
        structure: 'gerund_phrase',
        complexity: 0.7,
        tense: 'neutral',
      };

      const validResult = service._validateStructure('running swiftly', analysis);
      expect(validResult.isValid).toBe(true);

      const invalidResult = service._validateStructure('he runs fast', analysis);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.reason).toContain('gerund');
    });

    it('should validate prepositional phrase structure correctly', () => {
      const analysis = {
        structure: 'prepositional_phrase',
        complexity: 0.5,
        tense: 'neutral',
      };

      const validResult = service._validateStructure('under the bridge', analysis);
      expect(validResult.isValid).toBe(true);

      const invalidResult = service._validateStructure('the bridge above', analysis);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.reason).toContain('prepositional');
    });

    it('should validate past tense preservation', () => {
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.5,
        tense: 'past',
      };

      const validResult = service._validateStructure('he ran quickly', analysis);
      expect(validResult.isValid).toBe(true);

      const invalidResult = service._validateStructure('he runs quickly', analysis);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.reason).toContain('past tense');
    });

    it('should validate future tense preservation', () => {
      const analysis = {
        structure: 'simple_clause',
        complexity: 0.5,
        tense: 'future',
      };

      const validResult = service._validateStructure('he will run quickly', analysis);
      expect(validResult.isValid).toBe(true);
    });

    it('should reject empty or invalid text', () => {
      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.3,
        tense: 'neutral',
      };

      const result = service._validateStructure('', analysis);
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Empty');
    });
  });

  describe('_buildStructureRequirements', () => {
    it('should build gerund requirements', () => {
      const analysis = {
        structure: 'gerund_phrase',
        tense: 'neutral',
        isPlural: false,
      };

      const requirements = service._buildStructureRequirements(analysis, 0.5);

      expect(requirements).toContain('-ing verb form');
      expect(requirements).toContain('gerund');
    });

    it('should build prepositional requirements', () => {
      const analysis = {
        structure: 'prepositional_phrase',
        tense: 'neutral',
        isPlural: false,
      };

      const requirements = service._buildStructureRequirements(analysis, 0.5);

      expect(requirements).toContain('preposition');
    });

    it('should include tense preservation requirements', () => {
      const analysis = {
        structure: 'simple_clause',
        tense: 'past',
        isPlural: false,
      };

      const requirements = service._buildStructureRequirements(analysis, 0.5);

      expect(requirements).toContain('PAST');
    });

    it('should include plurality requirements', () => {
      const analysis = {
        structure: 'noun_phrase',
        tense: 'neutral',
        isPlural: true,
      };

      const requirements = service._buildStructureRequirements(analysis, 0.5);

      expect(requirements).toContain('plural');
    });

    it('should add strict warning at high strictness', () => {
      const analysis = {
        structure: 'gerund_phrase',
        tense: 'neutral',
        isPlural: false,
      };

      const requirements = service._buildStructureRequirements(analysis, 0.8);

      expect(requirements).toContain('STRICT');
    });
  });

  describe('_buildCorrectionSection', () => {
    it('should include previous error information', () => {
      const lastError = {
        badOutput: 'he ran fast',
        reason: 'Not a gerund',
        instruction: 'Must start with -ing',
      };

      const correction = service._buildCorrectionSection(lastError, 0.5);

      expect(correction).toContain('REJECTED');
      expect(correction).toContain('he ran fast');
      expect(correction).toContain('Not a gerund');
      expect(correction).toContain('Must start with -ing');
    });

    it('should add final attempt warning at high strictness', () => {
      const lastError = {
        badOutput: 'test',
        reason: 'Invalid',
        instruction: 'Fix it',
      };

      const correction = service._buildCorrectionSection(lastError, 0.9);

      expect(correction).toContain('FINAL ATTEMPT');
    });
  });

  describe('edge cases', () => {
    it('should handle LLM client errors gracefully', async () => {
      const params = {
        highlightedText: 'test',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'Test',
        originalUserPrompt: 'Test',
        isVideoPrompt: false,
      };

      const analysis = {
        structure: 'noun_phrase',
        complexity: 0.3,
        tense: 'neutral',
        isPlural: false,
      };

      vi.mock('../../../utils/StructuredOutputEnforcer.js', () => ({
        StructuredOutputEnforcer: {
          enforceJSON: vi.fn(() => Promise.reject(new Error('API Error'))),
        },
      }));

      const result = await service.generate(params, analysis, 1);

      expect(result).toBeNull();
    });
  });
});

