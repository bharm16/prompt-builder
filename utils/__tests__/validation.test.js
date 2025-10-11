import { describe, it, expect } from 'vitest';
import {
  promptSchema,
  suggestionSchema,
  customSuggestionSchema,
  sceneChangeSchema,
  creativeSuggestionSchema,
} from '../validation.js';

describe('Validation Schemas', () => {
  describe('promptSchema', () => {
    it('should validate a valid prompt with all fields', () => {
      const validPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
        context: {
          specificAspects: 'Some aspects',
          backgroundLevel: 'Intermediate',
          intendedUse: 'Learning',
        },
      };

      const { error, value } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
      expect(value).toEqual(validPrompt);
    });

    it('should validate a minimal valid prompt', () => {
      const validPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
      };

      const { error } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
    });

    it('should reject empty prompt', () => {
      const invalidPrompt = {
        prompt: '',
        mode: 'code',
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Prompt is required');
    });

    it('should reject missing prompt', () => {
      const invalidPrompt = {
        mode: 'code',
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Prompt is required');
    });

    it('should reject prompt exceeding max length', () => {
      const invalidPrompt = {
        prompt: 'a'.repeat(10001),
        mode: 'code',
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe(
        'Prompt must not exceed 10,000 characters'
      );
    });

    it('should accept prompt at max length', () => {
      const validPrompt = {
        prompt: 'a'.repeat(10000),
        mode: 'code',
      };

      const { error } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
    });

    it('should reject invalid mode', () => {
      const invalidPrompt = {
        prompt: 'Test prompt',
        mode: 'invalid-mode',
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('Mode must be one of');
    });

    it('should reject missing mode', () => {
      const invalidPrompt = {
        prompt: 'Test prompt',
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Mode is required');
    });

    it('should accept all valid modes', () => {
      const modes = [
        'code',
        'text',
        'learning',
        'video',
        'reasoning',
        'research',
        'socratic',
        'optimize',
      ];

      modes.forEach((mode) => {
        const validPrompt = {
          prompt: 'Test prompt',
          mode,
        };

        const { error } = promptSchema.validate(validPrompt);
        expect(error).toBeUndefined();
      });
    });

    it('should allow null context', () => {
      const validPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
        context: null,
      };

      const { error } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
    });

    it('should allow missing context', () => {
      const validPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
      };

      const { error } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
    });

    it('should allow empty strings in context fields', () => {
      const validPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
        context: {
          specificAspects: '',
          backgroundLevel: '',
          intendedUse: '',
        },
      };

      const { error } = promptSchema.validate(validPrompt);
      expect(error).toBeUndefined();
    });

    it('should reject context field exceeding max length', () => {
      const invalidPrompt = {
        prompt: 'Test prompt',
        mode: 'code',
        context: {
          specificAspects: 'a'.repeat(5001),
        },
      };

      const { error } = promptSchema.validate(invalidPrompt);
      expect(error).toBeDefined();
    });
  });

  describe('suggestionSchema', () => {
    it('should validate a complete suggestion request', () => {
      const validSuggestion = {
        highlightedText: 'Selected text',
        contextBefore: 'Context before',
        contextAfter: 'Context after',
        fullPrompt: 'Full prompt text',
        originalUserPrompt: 'Original prompt',
      };

      const { error } = suggestionSchema.validate(validSuggestion);
      expect(error).toBeUndefined();
    });

    it('should validate minimal suggestion request', () => {
      const validSuggestion = {
        highlightedText: 'Selected text',
        fullPrompt: 'Full prompt text',
      };

      const { error } = suggestionSchema.validate(validSuggestion);
      expect(error).toBeUndefined();
    });

    it('should reject empty highlighted text', () => {
      const invalidSuggestion = {
        highlightedText: '',
        fullPrompt: 'Full prompt',
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Highlighted text is required');
    });

    it('should reject missing highlighted text', () => {
      const invalidSuggestion = {
        fullPrompt: 'Full prompt',
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Highlighted text is required');
    });

    it('should reject empty full prompt', () => {
      const invalidSuggestion = {
        highlightedText: 'Selected text',
        fullPrompt: '',
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Full prompt is required');
    });

    it('should reject missing full prompt', () => {
      const invalidSuggestion = {
        highlightedText: 'Selected text',
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Full prompt is required');
    });

    it('should reject highlighted text exceeding max length', () => {
      const invalidSuggestion = {
        highlightedText: 'a'.repeat(10001),
        fullPrompt: 'Full prompt',
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('10,000 characters');
    });

    it('should reject full prompt exceeding max length', () => {
      const invalidSuggestion = {
        highlightedText: 'Selected text',
        fullPrompt: 'a'.repeat(50001),
      };

      const { error } = suggestionSchema.validate(invalidSuggestion);
      expect(error).toBeDefined();
      expect(error.details[0].message).toContain('50,000 characters');
    });

    it('should allow empty context fields', () => {
      const validSuggestion = {
        highlightedText: 'Selected text',
        contextBefore: '',
        contextAfter: '',
        fullPrompt: 'Full prompt text',
        originalUserPrompt: '',
      };

      const { error } = suggestionSchema.validate(validSuggestion);
      expect(error).toBeUndefined();
    });
  });

  describe('customSuggestionSchema', () => {
    it('should validate a valid custom suggestion request', () => {
      const validRequest = {
        highlightedText: 'Selected text',
        customRequest: 'Make it more concise',
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should reject missing highlighted text', () => {
      const invalidRequest = {
        customRequest: 'Make it more concise',
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Highlighted text is required');
    });

    it('should reject empty highlighted text', () => {
      const invalidRequest = {
        highlightedText: '',
        customRequest: 'Make it more concise',
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Highlighted text is required');
    });

    it('should reject missing custom request', () => {
      const invalidRequest = {
        highlightedText: 'Selected text',
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Custom request is required');
    });

    it('should reject empty custom request', () => {
      const invalidRequest = {
        highlightedText: 'Selected text',
        customRequest: '',
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
      expect(error.details[0].message).toBe('Custom request is required');
    });

    it('should reject custom request exceeding max length', () => {
      const invalidRequest = {
        highlightedText: 'Selected text',
        customRequest: 'a'.repeat(1001),
        fullPrompt: 'Full prompt text',
      };

      const { error } = customSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });
  });

  describe('sceneChangeSchema', () => {
    it('should validate a complete scene change request', () => {
      const validRequest = {
        changedField: 'location',
        newValue: 'New location value',
        oldValue: 'Old location value',
        fullPrompt: 'Full prompt text',
        affectedFields: { mood: 'Updated mood' },
      };

      const { error } = sceneChangeSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should validate scene change with null old value', () => {
      const validRequest = {
        changedField: 'location',
        newValue: 'New location value',
        oldValue: null,
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should validate scene change with empty old value', () => {
      const validRequest = {
        changedField: 'location',
        newValue: 'New location value',
        oldValue: '',
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should validate scene change without affected fields', () => {
      const validRequest = {
        changedField: 'location',
        newValue: 'New location value',
        oldValue: 'Old value',
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should reject missing changed field', () => {
      const invalidRequest = {
        newValue: 'New location value',
        oldValue: 'Old value',
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject missing new value', () => {
      const invalidRequest = {
        changedField: 'location',
        oldValue: 'Old value',
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject new value exceeding max length', () => {
      const invalidRequest = {
        changedField: 'location',
        newValue: 'a'.repeat(10001),
        oldValue: 'Old value',
        fullPrompt: 'Full prompt text',
      };

      const { error } = sceneChangeSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });
  });

  describe('creativeSuggestionSchema', () => {
    it('should validate all valid element types', () => {
      const elementTypes = [
        'subject',
        'action',
        'location',
        'time',
        'mood',
        'style',
        'event',
      ];

      elementTypes.forEach((elementType) => {
        const validRequest = {
          elementType,
          currentValue: 'Current value',
          context: 'Context',
          concept: 'Concept',
        };

        const { error } = creativeSuggestionSchema.validate(validRequest);
        expect(error).toBeUndefined();
      });
    });

    it('should validate with minimal fields', () => {
      const validRequest = {
        elementType: 'subject',
      };

      const { error } = creativeSuggestionSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should validate with empty optional fields', () => {
      const validRequest = {
        elementType: 'subject',
        currentValue: '',
        context: '',
        concept: '',
      };

      const { error } = creativeSuggestionSchema.validate(validRequest);
      expect(error).toBeUndefined();
    });

    it('should reject invalid element type', () => {
      const invalidRequest = {
        elementType: 'invalid',
        currentValue: '',
        context: '',
        concept: '',
      };

      const { error } = creativeSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject missing element type', () => {
      const invalidRequest = {
        currentValue: 'Current value',
        context: 'Context',
        concept: 'Concept',
      };

      const { error } = creativeSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject current value exceeding max length', () => {
      const invalidRequest = {
        elementType: 'subject',
        currentValue: 'a'.repeat(5001),
      };

      const { error } = creativeSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject context exceeding max length', () => {
      const invalidRequest = {
        elementType: 'subject',
        context: 'a'.repeat(5001),
      };

      const { error } = creativeSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });

    it('should reject concept exceeding max length', () => {
      const invalidRequest = {
        elementType: 'subject',
        concept: 'a'.repeat(10001),
      };

      const { error } = creativeSuggestionSchema.validate(invalidRequest);
      expect(error).toBeDefined();
    });
  });
});
