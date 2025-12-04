/**
 * @test {GroqSchema}
 * @description Tests for Groq/Llama 3 optimized schema and conditional prompt functions
 * 
 * Test Coverage:
 * - getGroqSystemPrompt: Conditional format instruction removal
 * - getGroqSandwichReminder: Conditional sandwich prompting
 * - GROQ_FULL_SYSTEM_PROMPT: Structure and content
 * - GROQ_VALIDATION_SCHEMA: Validation-only schema structure
 * 
 * These tests verify the Groq-specific optimizations don't affect OpenAI behavior
 * by testing the Groq functions in isolation.
 */

import { describe, it, expect } from 'vitest';
import {
  GROQ_FULL_SYSTEM_PROMPT,
  GROQ_VALIDATION_SCHEMA,
  GROQ_SANDWICH_REMINDER,
  GROQ_FEW_SHOT_EXAMPLES,
  LLAMA3_TYPESCRIPT_INTERFACE,
  LLAMA3_CATEGORY_TABLE,
  LLAMA3_DISAMBIGUATION_RULES,
  getGroqSystemPrompt,
  getGroqSandwichReminder,
  VALID_TAXONOMY_IDS,
} from '../GroqSchema.js';

describe('GroqSchema', () => {
  // ============================================
  // getGroqSystemPrompt Tests
  // ============================================

  describe('getGroqSystemPrompt', () => {
    describe('when useJsonSchema is false', () => {
      it('should return the full system prompt unchanged', () => {
        // Act
        const result = getGroqSystemPrompt(false);

        // Assert
        expect(result).toBe(GROQ_FULL_SYSTEM_PROMPT);
      });

      it('should include "Output ONLY valid JSON" instruction', () => {
        // Act
        const result = getGroqSystemPrompt(false);

        // Assert
        expect(result).toContain('Output ONLY valid JSON');
      });

      it('should include the "Remember" reminder at the end', () => {
        // Act
        const result = getGroqSystemPrompt(false);

        // Assert
        expect(result).toContain('**Remember:** Output ONLY valid JSON');
      });
    });

    describe('when useJsonSchema is true', () => {
      it('should return a modified prompt (not identical to full prompt)', () => {
        // Act
        const result = getGroqSystemPrompt(true);

        // Assert
        expect(result).not.toBe(GROQ_FULL_SYSTEM_PROMPT);
      });

      it('should remove "Output ONLY valid JSON" from opening line', () => {
        // Arrange
        const fullPrompt = getGroqSystemPrompt(false);
        const optimizedPrompt = getGroqSystemPrompt(true);

        // Assert
        // Full prompt starts with: "Label video prompt elements using the taxonomy. Output ONLY valid JSON..."
        expect(fullPrompt).toMatch(/^Label video prompt elements using the taxonomy\. Output ONLY valid JSON/);
        // Optimized prompt should NOT have "Output ONLY valid JSON" in opening
        expect(optimizedPrompt).toMatch(/^Label video prompt elements using the taxonomy\. Match the SpanLabelingResponse interface\./);
      });

      it('should remove the "Remember" reminder from the end', () => {
        // Act
        const result = getGroqSystemPrompt(true);

        // Assert
        expect(result).not.toContain('**Remember:** Output ONLY valid JSON');
      });

      it('should still contain all essential content', () => {
        // Act
        const result = getGroqSystemPrompt(true);

        // Assert - Essential sections should remain
        expect(result).toContain('## Response Interface');
        expect(result).toContain('## Valid Taxonomy IDs');
        expect(result).toContain('## What TO Label');
        expect(result).toContain('## Category Quick Reference');
        expect(result).toContain('## Decision Tree');
        expect(result).toContain('## Critical Rules');
        expect(result).toContain('## Adversarial Detection');
        expect(result).toContain('## Example');
      });

      it('should still contain the TypeScript interface', () => {
        // Act
        const result = getGroqSystemPrompt(true);

        // Assert
        expect(result).toContain('interface Span');
        expect(result).toContain('interface SpanLabelingResponse');
      });

      it('should still contain disambiguation rules', () => {
        // Act
        const result = getGroqSystemPrompt(true);

        // Assert
        expect(result).toContain('Quick Decision Tree');
        expect(result).toContain('camera.movement');
      });

      it('should be shorter than the full prompt', () => {
        // Act
        const fullPrompt = getGroqSystemPrompt(false);
        const optimizedPrompt = getGroqSystemPrompt(true);

        // Assert
        expect(optimizedPrompt.length).toBeLessThan(fullPrompt.length);
      });

      it('should save at least 50 characters (format instruction removal)', () => {
        // Act
        const fullPrompt = getGroqSystemPrompt(false);
        const optimizedPrompt = getGroqSystemPrompt(true);
        const savings = fullPrompt.length - optimizedPrompt.length;

        // Assert - "Output ONLY valid JSON" alone is ~20 chars, plus the Remember section
        expect(savings).toBeGreaterThanOrEqual(50);
      });
    });
  });

  // ============================================
  // getGroqSandwichReminder Tests
  // ============================================

  describe('getGroqSandwichReminder', () => {
    describe('when useJsonSchema is false', () => {
      it('should return the full sandwich reminder', () => {
        // Act
        const result = getGroqSandwichReminder(false);

        // Assert
        expect(result).toBe(GROQ_SANDWICH_REMINDER);
      });

      it('should include format enforcement instructions', () => {
        // Act
        const result = getGroqSandwichReminder(false);

        // Assert
        expect(result).toContain('Output ONLY valid JSON');
        expect(result).toContain('No markdown code blocks');
      });
    });

    describe('when useJsonSchema is true', () => {
      it('should return a minimal reminder', () => {
        // Act
        const result = getGroqSandwichReminder(true);

        // Assert
        expect(result).toBe('Respond with the JSON object now.');
      });

      it('should NOT include verbose format instructions', () => {
        // Act
        const result = getGroqSandwichReminder(true);

        // Assert
        expect(result).not.toContain('Output ONLY valid JSON');
        expect(result).not.toContain('No markdown code blocks');
        expect(result).not.toContain('no explanatory text');
      });

      it('should be significantly shorter than the full reminder', () => {
        // Act
        const fullReminder = getGroqSandwichReminder(false);
        const minimalReminder = getGroqSandwichReminder(true);

        // Assert
        expect(minimalReminder.length).toBeLessThan(fullReminder.length / 2);
      });
    });
  });

  // ============================================
  // GROQ_FULL_SYSTEM_PROMPT Tests
  // ============================================

  describe('GROQ_FULL_SYSTEM_PROMPT', () => {
    it('should contain the TypeScript interface', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain(LLAMA3_TYPESCRIPT_INTERFACE);
    });

    it('should contain the category mapping table', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain(LLAMA3_CATEGORY_TABLE);
    });

    it('should contain disambiguation rules', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain(LLAMA3_DISAMBIGUATION_RULES);
    });

    it('should contain all valid taxonomy IDs', () => {
      // Check a sample of taxonomy IDs are present
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('camera.movement');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('subject.identity');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('action.movement');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('shot.type');
    });

    it('should contain adversarial detection instructions', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('isAdversarial');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('adversarial input');
    });

    it('should contain Chain-of-Thought instructions', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('analysis_trace');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Chain-of-Thought');
    });

    it('should contain an example', () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('## Example');
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Close-up shot of weathered hands');
    });
  });

  // ============================================
  // GROQ_VALIDATION_SCHEMA Tests
  // ============================================

  describe('GROQ_VALIDATION_SCHEMA', () => {
    it('should have the correct name', () => {
      expect(GROQ_VALIDATION_SCHEMA.name).toBe('span_labeling_response');
    });

    it('should NOT have strict mode (Groq uses validation-only)', () => {
      // Groq schema should NOT have strict: true
      expect(GROQ_VALIDATION_SCHEMA.strict).toBeUndefined();
    });

    it('should have required fields', () => {
      const schema = GROQ_VALIDATION_SCHEMA.schema;
      expect(schema.required).toContain('analysis_trace');
      expect(schema.required).toContain('spans');
      expect(schema.required).toContain('meta');
      expect(schema.required).toContain('isAdversarial');
    });

    it('should have additionalProperties: false', () => {
      expect(GROQ_VALIDATION_SCHEMA.schema.additionalProperties).toBe(false);
    });

    it('should have role enum with valid taxonomy IDs', () => {
      const roleProperty = GROQ_VALIDATION_SCHEMA.schema.properties.spans.items.properties.role;
      expect(roleProperty.enum).toBeDefined();
      expect(roleProperty.enum).toEqual(expect.arrayContaining(['camera.movement', 'subject.identity']));
    });

    it('should have confidence with min/max constraints', () => {
      const confidenceProperty = GROQ_VALIDATION_SCHEMA.schema.properties.spans.items.properties.confidence;
      expect(confidenceProperty.minimum).toBe(0);
      expect(confidenceProperty.maximum).toBe(1);
    });

    it('should have minimal descriptions (Groq optimization)', () => {
      // Groq schema should have minimal descriptions since Llama 3 doesn't process them during generation
      const textDescription = GROQ_VALIDATION_SCHEMA.schema.properties.spans.items.properties.text.description;
      expect(textDescription).toBeDefined();
      expect(textDescription.length).toBeLessThan(50); // Short description
    });
  });

  // ============================================
  // GROQ_FEW_SHOT_EXAMPLES Tests
  // ============================================

  describe('GROQ_FEW_SHOT_EXAMPLES', () => {
    it('should have at least 3 examples', () => {
      // Each example is a user/assistant pair, so 3 examples = 6 messages
      expect(GROQ_FEW_SHOT_EXAMPLES.length).toBeGreaterThanOrEqual(6);
    });

    it('should alternate between user and assistant roles', () => {
      for (let i = 0; i < GROQ_FEW_SHOT_EXAMPLES.length; i += 2) {
        expect(GROQ_FEW_SHOT_EXAMPLES[i].role).toBe('user');
        expect(GROQ_FEW_SHOT_EXAMPLES[i + 1].role).toBe('assistant');
      }
    });

    it('should have user messages wrapped in XML tags', () => {
      const userMessages = GROQ_FEW_SHOT_EXAMPLES.filter(m => m.role === 'user');
      for (const msg of userMessages) {
        expect(msg.content).toContain('<user_input>');
        expect(msg.content).toContain('</user_input>');
      }
    });

    it('should have assistant messages that are valid JSON', () => {
      const assistantMessages = GROQ_FEW_SHOT_EXAMPLES.filter(m => m.role === 'assistant');
      for (const msg of assistantMessages) {
        expect(() => JSON.parse(msg.content)).not.toThrow();
      }
    });

    it('should have examples with analysis_trace field', () => {
      const assistantMessages = GROQ_FEW_SHOT_EXAMPLES.filter(m => m.role === 'assistant');
      for (const msg of assistantMessages) {
        const parsed = JSON.parse(msg.content);
        expect(parsed.analysis_trace).toBeDefined();
        expect(typeof parsed.analysis_trace).toBe('string');
      }
    });

    it('should have examples with v4-groq version', () => {
      const assistantMessages = GROQ_FEW_SHOT_EXAMPLES.filter(m => m.role === 'assistant');
      for (const msg of assistantMessages) {
        const parsed = JSON.parse(msg.content);
        expect(parsed.meta.version).toBe('v4-groq');
      }
    });
  });

  // ============================================
  // GROQ_SANDWICH_REMINDER Tests
  // ============================================

  describe('GROQ_SANDWICH_REMINDER', () => {
    it('should be a non-empty string', () => {
      expect(typeof GROQ_SANDWICH_REMINDER).toBe('string');
      expect(GROQ_SANDWICH_REMINDER.length).toBeGreaterThan(0);
    });

    it('should contain JSON format instructions', () => {
      expect(GROQ_SANDWICH_REMINDER).toContain('JSON');
    });

    it('should discourage markdown', () => {
      expect(GROQ_SANDWICH_REMINDER.toLowerCase()).toContain('no markdown');
    });
  });

  // ============================================
  // VALID_TAXONOMY_IDS Tests
  // ============================================

  describe('VALID_TAXONOMY_IDS', () => {
    it('should be an array', () => {
      expect(Array.isArray(VALID_TAXONOMY_IDS)).toBe(true);
    });

    it('should contain expected taxonomy IDs', () => {
      expect(VALID_TAXONOMY_IDS).toContain('camera.movement');
      expect(VALID_TAXONOMY_IDS).toContain('camera.angle');
      expect(VALID_TAXONOMY_IDS).toContain('subject.identity');
      expect(VALID_TAXONOMY_IDS).toContain('subject.appearance');
      expect(VALID_TAXONOMY_IDS).toContain('action.movement');
      expect(VALID_TAXONOMY_IDS).toContain('shot.type');
      expect(VALID_TAXONOMY_IDS).toContain('lighting.source');
      expect(VALID_TAXONOMY_IDS).toContain('environment.location');
    });

    it('should have taxonomy IDs in dot notation format', () => {
      for (const id of VALID_TAXONOMY_IDS) {
        expect(id).toMatch(/^[a-z]+\.[a-zA-Z]+$/);
      }
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration', () => {
    it('should have consistent taxonomy IDs across schema and prompt', () => {
      // Get taxonomy IDs from schema enum
      const schemaEnum = GROQ_VALIDATION_SCHEMA.schema.properties.spans.items.properties.role.enum;
      
      // All schema enum values should be in VALID_TAXONOMY_IDS
      for (const id of schemaEnum) {
        expect(VALID_TAXONOMY_IDS).toContain(id);
      }
    });

    it('should produce valid prompts for both modes', () => {
      // Both modes should produce non-empty, valid prompts
      const fullPrompt = getGroqSystemPrompt(false);
      const optimizedPrompt = getGroqSystemPrompt(true);

      expect(fullPrompt.length).toBeGreaterThan(500);
      expect(optimizedPrompt.length).toBeGreaterThan(500);
      
      // Both should start with the expected opening
      expect(fullPrompt).toMatch(/^Label video prompt elements/);
      expect(optimizedPrompt).toMatch(/^Label video prompt elements/);
    });
  });
});
