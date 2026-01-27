import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enhancePromptForJSON, enhancePromptWithErrorFeedback } from '../promptEnhancers';
import type { StructuredOutputSchema } from '../types';

// Mock the logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('enhancePromptForJSON', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles null schema', () => {
      const result = enhancePromptForJSON('Base prompt', true, false, true, null);

      expect(result).toContain('Base prompt');
      expect(result).toContain('[');
    });

    it('handles undefined schema', () => {
      const result = enhancePromptForJSON('Base prompt', true, false, true, undefined);

      expect(result).toContain('Base prompt');
      expect(result).toContain('[');
    });

    it('handles empty system prompt', () => {
      const result = enhancePromptForJSON('', true, false, true, null);

      expect(result).toContain('Respond with ONLY valid JSON');
    });
  });

  describe('edge cases', () => {
    it('returns original prompt when strict schema and no format instructions needed', () => {
      const result = enhancePromptForJSON('Base prompt', true, true, false, null);

      expect(result).toBe('Base prompt');
    });

    it('adds format instructions when strict schema but format instructions needed', () => {
      const result = enhancePromptForJSON('Base prompt', true, true, true, null);

      expect(result).toContain('Respond with ONLY valid JSON');
    });

    it('logs debug message when skipping instructions', async () => {
      enhancePromptForJSON('Base prompt', true, true, false, null);

      const { logger } = await import('@infrastructure/Logger');
      expect(logger.debug).toHaveBeenCalledWith(
        'Skipping JSON format instructions (strict schema mode)'
      );
    });
  });

  describe('core behavior', () => {
    it('adds array format instruction when isArray is true', () => {
      const result = enhancePromptForJSON('Base prompt', true, false, true, null);

      expect(result).toContain('Start with [');
    });

    it('adds object format instruction when isArray is false', () => {
      const result = enhancePromptForJSON('Base prompt', false, false, true, null);

      expect(result).toContain('Start with {');
    });

    it('adds object format instruction when schema type is object', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const result = enhancePromptForJSON('Base prompt', true, false, true, schema);

      expect(result).toContain('Start with {');
    });

    it('adds suggestions wrapper format when schema requires it', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['suggestions'],
      };
      const result = enhancePromptForJSON('Base prompt', true, false, true, schema);

      expect(result).toContain('{"suggestions": [...your suggestions array here...]}');
    });

    it('preserves original prompt content', () => {
      const originalPrompt = 'This is a detailed instruction for the LLM';
      const result = enhancePromptForJSON(originalPrompt, true, false, true, null);

      expect(result).toContain(originalPrompt);
    });
  });
});

describe('enhancePromptWithErrorFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('handles null schema', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Parse error',
        true,
        true,
        null
      );

      expect(result).toContain('Base prompt');
      expect(result).toContain('Parse error');
    });

    it('handles undefined schema', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Parse error',
        true,
        true,
        undefined
      );

      expect(result).toContain('Base prompt');
      expect(result).toContain('Parse error');
    });

    it('handles empty error message', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        '',
        true,
        true,
        null
      );

      expect(result).toContain('Previous attempt failed:');
    });
  });

  describe('edge cases', () => {
    it('adds suggestions wrapper retry instructions when schema requires it', () => {
      const schema: StructuredOutputSchema = {
        type: 'object',
        required: ['suggestions'],
      };
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Invalid JSON',
        true,
        true,
        schema
      );

      expect(result).toContain('RETRY - USE THIS EXACT FORMAT');
      expect(result).toContain('{"suggestions": [array of suggestion objects]}');
      expect(result).toContain('Do NOT return a bare array');
    });

    it('includes retry instructions with object start for object schema', () => {
      const schema: StructuredOutputSchema = { type: 'object' };
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Parse error',
        true,
        true,
        schema
      );

      expect(result).toContain('Start with {');
    });
  });

  describe('core behavior', () => {
    it('includes error message in retry prompt', () => {
      const errorMessage = 'Unexpected token at position 42';
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        errorMessage,
        true,
        true,
        null
      );

      expect(result).toContain(errorMessage);
    });

    it('includes retry instructions section', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Error',
        true,
        true,
        null
      );

      expect(result).toContain('RETRY INSTRUCTIONS');
    });

    it('instructs to avoid markdown code blocks', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Error',
        true,
        true,
        null
      );

      expect(result).toContain('No markdown code blocks');
    });

    it('instructs to ensure required fields', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Error',
        true,
        true,
        null
      );

      expect(result).toContain('Ensure all required fields are present');
    });

    it('adds array format instruction when isArray is true and no object schema', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Error',
        true,
        true,
        null
      );

      expect(result).toContain('Start with [');
    });

    it('adds object format instruction when isArray is false', () => {
      const result = enhancePromptWithErrorFeedback(
        'Base prompt',
        'Error',
        false,
        true,
        null
      );

      expect(result).toContain('Start with {');
    });

    it('preserves original prompt content', () => {
      const originalPrompt = 'Generate a list of suggestions';
      const result = enhancePromptWithErrorFeedback(
        originalPrompt,
        'Error',
        true,
        true,
        null
      );

      expect(result).toContain(originalPrompt);
    });
  });
});
