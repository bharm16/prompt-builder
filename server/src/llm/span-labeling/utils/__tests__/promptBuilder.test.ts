/**
 * @test {promptBuilder}
 * @description Tests for span labeling prompt builder with provider-specific optimizations
 * 
 * Test Coverage:
 * - buildSystemPrompt: Provider selection, useJsonSchema optimization
 * - buildSpanLabelingMessages: Complete message array construction
 * - getProviderConfig: Feature lists including new optimizations
 * - getSchema: Provider-specific schema selection
 * - getFewShotExamples: Provider-specific examples
 * - getResponseFormat: Response format construction
 * - getAdapterOptions: Adapter configuration
 * - Backward compatibility: Default parameters
 * 
 * Pattern: TypeScript test following AAA pattern
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildSystemPrompt,
  buildSpanLabelingMessages,
  getProviderConfig,
  getSchema,
  getFewShotExamples,
  getResponseFormat,
  getAdapterOptions,
  BASE_SYSTEM_PROMPT,
  buildContextAwareSystemPrompt,
  VALID_TAXONOMY_IDS,
} from '../promptBuilder';

// Mock logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock security prompts
vi.mock('@utils/SecurityPrompts.js', () => ({
  IMMUTABLE_SOVEREIGN_PREAMBLE: '[SECURITY_PREAMBLE]',
}));

describe('promptBuilder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // buildSystemPrompt Tests
  // ============================================

  describe('buildSystemPrompt', () => {
    describe('provider selection', () => {
      it('should use OpenAI minimal prompt for openai provider', () => {
        // Act
        const result = buildSystemPrompt('', false, 'openai');

        // Assert
        expect(result).toContain('[SECURITY_PREAMBLE]');
        // OpenAI uses minimal prompt - should NOT contain Groq-specific content
        expect(result).not.toContain('GAtt');
        expect(result).not.toContain('Sandwich');
      });

      it('should use Groq full prompt for groq provider', () => {
        // Act
        const result = buildSystemPrompt('', false, 'groq');

        // Assert
        expect(result).toContain('[SECURITY_PREAMBLE]');
        // Groq uses full prompt with taxonomy and rules
        expect(result).toContain('camera.movement');
        expect(result).toContain('subject.identity');
      });

      it('should default to groq when provider not specified', () => {
        // Act
        const result = buildSystemPrompt();

        // Assert - Should contain Groq-specific content
        expect(result).toContain('camera.movement');
      });

      it('should handle case-insensitive provider names', () => {
        // Act
        const result1 = buildSystemPrompt('', false, 'OPENAI');
        const result2 = buildSystemPrompt('', false, 'OpenAI');
        const result3 = buildSystemPrompt('', false, 'openai');

        // Assert - All should produce same result (OpenAI minimal prompt)
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      });

      it('should treat unknown providers as groq', () => {
        // Act
        const result = buildSystemPrompt('', false, 'unknown');

        // Assert - Should use Groq prompt
        expect(result).toContain('camera.movement');
      });
    });

    describe('useJsonSchema optimization (Groq)', () => {
      it('should return full prompt when useJsonSchema is false', () => {
        // Act
        const result = buildSystemPrompt('', false, 'groq', false);

        // Assert
        expect(result).toContain('Output ONLY valid JSON');
      });

      it('should return optimized prompt when useJsonSchema is true', () => {
        // Act
        const fullPrompt = buildSystemPrompt('', false, 'groq', false);
        const optimizedPrompt = buildSystemPrompt('', false, 'groq', true);

        // Assert
        expect(optimizedPrompt.length).toBeLessThan(fullPrompt.length);
        // Should NOT contain redundant format instruction in opening
        expect(optimizedPrompt).not.toMatch(/^.*Output ONLY valid JSON matching/);
      });

      it('should default useJsonSchema to false for backward compatibility', () => {
        // Act
        const withDefault = buildSystemPrompt('', false, 'groq');
        const withExplicitFalse = buildSystemPrompt('', false, 'groq', false);

        // Assert
        expect(withDefault).toBe(withExplicitFalse);
      });

      it('should NOT affect OpenAI prompt regardless of useJsonSchema', () => {
        // Act
        const withFalse = buildSystemPrompt('', false, 'openai', false);
        const withTrue = buildSystemPrompt('', false, 'openai', true);

        // Assert - OpenAI prompt should be identical (useJsonSchema is Groq-only)
        expect(withFalse).toBe(withTrue);
      });
    });

    describe('security preamble', () => {
      it('should include security preamble for all providers', () => {
        // Act
        const groqResult = buildSystemPrompt('', false, 'groq');
        const openaiResult = buildSystemPrompt('', false, 'openai');

        // Assert
        expect(groqResult).toContain('[SECURITY_PREAMBLE]');
        expect(openaiResult).toContain('[SECURITY_PREAMBLE]');
      });

      it('should place security preamble at the beginning', () => {
        // Act
        const result = buildSystemPrompt('', false, 'groq');

        // Assert
        expect(result.startsWith('[SECURITY_PREAMBLE]')).toBe(true);
      });
    });
  });

  // ============================================
  // buildSpanLabelingMessages Tests
  // ============================================

  describe('buildSpanLabelingMessages', () => {
    describe('message structure', () => {
      it('should include system message first', () => {
        // Act
        const messages = buildSpanLabelingMessages('test input', true, 'groq');

        // Assert
        expect(messages[0].role).toBe('system');
        expect(messages[0].content).toContain('[SECURITY_PREAMBLE]');
      });

      it('should include user input wrapped in XML tags', () => {
        // Act
        const messages = buildSpanLabelingMessages('test input', true, 'groq');

        // Assert
        const userMessages = messages.filter(m => m.role === 'user');
        const inputMessage = userMessages.find(m => m.content.includes('<user_input>'));
        expect(inputMessage).toBeDefined();
        expect(inputMessage?.content).toContain('<user_input>\ntest input\n</user_input>');
      });

      it('should include few-shot examples when includeFewShot is true', () => {
        // Act
        const withFewShot = buildSpanLabelingMessages('test', true, 'groq');
        const withoutFewShot = buildSpanLabelingMessages('test', false, 'groq');

        // Assert
        expect(withFewShot.length).toBeGreaterThan(withoutFewShot.length);
      });

      it('should NOT include few-shot examples when includeFewShot is false', () => {
        // Act
        const messages = buildSpanLabelingMessages('test', false, 'groq');

        // Assert - Should only have: system, user input, sandwich reminder
        expect(messages.length).toBe(3);
      });
    });

    describe('Groq sandwich reminder', () => {
      it('should include sandwich reminder for Groq provider', () => {
        // Act
        const messages = buildSpanLabelingMessages('test', false, 'groq');

        // Assert
        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.role).toBe('user');
        expect(lastMessage.content).toContain('JSON');
      });

      it('should NOT include sandwich reminder for OpenAI provider', () => {
        // Act
        const messages = buildSpanLabelingMessages('test', false, 'openai');

        // Assert - Last message should be the user input, not sandwich
        const lastMessage = messages[messages.length - 1];
        expect(lastMessage.content).toContain('<user_input>');
      });

      it('should use full sandwich reminder when useJsonSchema is false', () => {
        // Act
        const messages = buildSpanLabelingMessages('test', false, 'groq', false);
        const lastMessage = messages[messages.length - 1];

        // Assert
        expect(lastMessage.content).toContain('Output ONLY valid JSON');
        expect(lastMessage.content).toContain('No markdown');
      });

      it('should use minimal sandwich reminder when useJsonSchema is true', () => {
        // Act
        const messages = buildSpanLabelingMessages('test', false, 'groq', true);
        const lastMessage = messages[messages.length - 1];

        // Assert
        expect(lastMessage.content).toBe('Respond with the JSON object now.');
        expect(lastMessage.content).not.toContain('No markdown');
      });
    });

    describe('useJsonSchema optimization', () => {
      it('should pass useJsonSchema to buildSystemPrompt', () => {
        // Act
        const messagesWithSchema = buildSpanLabelingMessages('test', false, 'groq', true);
        const messagesWithoutSchema = buildSpanLabelingMessages('test', false, 'groq', false);

        // Assert - System prompts should differ
        const systemWithSchema = messagesWithSchema[0].content;
        const systemWithoutSchema = messagesWithoutSchema[0].content;
        expect(systemWithSchema.length).toBeLessThan(systemWithoutSchema.length);
      });

      it('should default useJsonSchema to false', () => {
        // Act
        const withDefault = buildSpanLabelingMessages('test', false, 'groq');
        const withExplicitFalse = buildSpanLabelingMessages('test', false, 'groq', false);

        // Assert
        expect(withDefault).toEqual(withExplicitFalse);
      });
    });
  });

  // ============================================
  // getProviderConfig Tests
  // ============================================

  describe('getProviderConfig', () => {
    describe('Groq configuration', () => {
      it('should include new optimizations in features list', () => {
        // Act
        const config = getProviderConfig('groq');

        // Assert
        expect(config.features).toContain('stop-sequences');
        expect(config.features).toContain('min-p-sampling');
        expect(config.features).toContain('conditional-format-instructions');
      });

      it('should include all Groq features', () => {
        // Act
        const config = getProviderConfig('groq');

        // Assert
        expect(config.features).toContain('validation-only-schema');
        expect(config.features).toContain('gatt-attention-mechanism');
        expect(config.features).toContain('sandwich-prompting');
        expect(config.features).toContain('prefill-assistant');
        expect(config.features).toContain('xml-wrapping');
        expect(config.features).toContain('full-rules-in-prompt');
      });

      it('should return correct token estimates', () => {
        // Act
        const config = getProviderConfig('groq');

        // Assert
        expect(config.promptTokens).toBe(1000);
        expect(config.schemaTokens).toBe(200);
        expect(config.totalTokens).toBe(1200);
      });

      it('should return correct strategy', () => {
        // Act
        const config = getProviderConfig('groq');

        // Assert
        expect(config.strategy).toBe('prompt-centric');
      });
    });

    describe('OpenAI configuration', () => {
      it('should NOT include Groq-specific features', () => {
        // Act
        const config = getProviderConfig('openai');

        // Assert
        expect(config.features).not.toContain('stop-sequences');
        expect(config.features).not.toContain('min-p-sampling');
        expect(config.features).not.toContain('conditional-format-instructions');
        expect(config.features).not.toContain('sandwich-prompting');
      });

      it('should include OpenAI features', () => {
        // Act
        const config = getProviderConfig('openai');

        // Assert
        expect(config.features).toContain('grammar-constrained-decoding');
        expect(config.features).toContain('schema-descriptions-processed');
        expect(config.features).toContain('strict-mode');
        expect(config.features).toContain('minimal-prompt');
      });

      it('should return correct token estimates', () => {
        // Act
        const config = getProviderConfig('openai');

        // Assert
        expect(config.promptTokens).toBe(400);
        expect(config.schemaTokens).toBe(600);
        expect(config.totalTokens).toBe(1000);
      });

      it('should return correct strategy', () => {
        // Act
        const config = getProviderConfig('openai');

        // Assert
        expect(config.strategy).toBe('description-enriched');
      });
    });

    describe('case insensitivity', () => {
      it('should handle case-insensitive provider names', () => {
        // Act
        const config1 = getProviderConfig('GROQ');
        const config2 = getProviderConfig('Groq');
        const config3 = getProviderConfig('groq');

        // Assert
        expect(config1).toEqual(config2);
        expect(config2).toEqual(config3);
      });
    });
  });

  // ============================================
  // getSchema Tests
  // ============================================

  describe('getSchema', () => {
    it('should return OpenAI enriched schema for openai provider', () => {
      // Act
      const schema = getSchema('openai') as { strict?: boolean };

      // Assert - OpenAI schema has strict mode
      expect(schema).toBeDefined();
      expect(schema.strict).toBe(true);
    });

    it('should return Groq validation schema for groq provider', () => {
      // Act
      const schema = getSchema('groq') as { strict?: boolean; name?: string };

      // Assert - Groq schema does NOT have strict mode
      expect(schema).toBeDefined();
      expect(schema.strict).toBeUndefined();
      expect(schema.name).toBe('span_labeling_response');
    });

    it('should handle case-insensitive provider names', () => {
      // Act
      const schema1 = getSchema('OPENAI');
      const schema2 = getSchema('openai');

      // Assert
      expect(schema1).toEqual(schema2);
    });

    it('should default to Groq schema for unknown providers', () => {
      // Act
      const schema = getSchema('unknown') as { name?: string };

      // Assert
      expect(schema.name).toBe('span_labeling_response');
    });
  });

  // ============================================
  // getFewShotExamples Tests
  // ============================================

  describe('getFewShotExamples', () => {
    it('should return OpenAI examples for openai provider', () => {
      // Act
      const examples = getFewShotExamples('openai');

      // Assert
      expect(examples).toBeDefined();
      expect(Array.isArray(examples)).toBe(true);
    });

    it('should return Groq examples for groq provider', () => {
      // Act
      const examples = getFewShotExamples('groq');

      // Assert
      expect(examples).toBeDefined();
      expect(Array.isArray(examples)).toBe(true);
      // Groq examples should have v4-groq version
      const assistantExamples = examples.filter(e => e.role === 'assistant');
      const firstExample = JSON.parse(assistantExamples[0].content);
      expect(firstExample.meta.version).toBe('v4-groq');
    });

    it('should return more examples for Groq than OpenAI', () => {
      // Act
      const groqExamples = getFewShotExamples('groq');
      const openaiExamples = getFewShotExamples('openai');

      // Assert - Groq needs more examples since rules aren't in schema
      expect(groqExamples.length).toBeGreaterThanOrEqual(openaiExamples.length);
    });

    it('should handle case-insensitive provider names', () => {
      // Act
      const examples1 = getFewShotExamples('GROQ');
      const examples2 = getFewShotExamples('groq');

      // Assert
      expect(examples1).toEqual(examples2);
    });
  });

  // ============================================
  // getResponseFormat Tests
  // ============================================

  describe('getResponseFormat', () => {
    it('should return json_schema type', () => {
      // Act
      const format = getResponseFormat('groq');

      // Assert
      expect(format.type).toBe('json_schema');
    });

    it('should include provider-specific schema', () => {
      // Act
      const groqFormat = getResponseFormat('groq');
      const openaiFormat = getResponseFormat('openai');

      // Assert
      expect(groqFormat.json_schema).toBeDefined();
      expect(openaiFormat.json_schema).toBeDefined();
      expect(groqFormat.json_schema).not.toEqual(openaiFormat.json_schema);
    });
  });

  // ============================================
  // getAdapterOptions Tests
  // ============================================

  describe('getAdapterOptions', () => {
    describe('Groq options', () => {
      it('should include Groq-specific options', () => {
        // Act
        const options = getAdapterOptions('groq');

        // Assert
        expect(options.enableSandwich).toBe(true);
        expect(options.enablePrefill).toBe(true);
        expect(options.jsonMode).toBe(true);
        expect(options.logprobs).toBe(true);
        expect(options.topLogprobs).toBe(3);
        expect(options.retryOnValidationFailure).toBe(true);
        expect(options.maxRetries).toBe(2);
      });

      it('should include Groq validation schema', () => {
        // Act
        const options = getAdapterOptions('groq');
        const schema = options.schema as { name?: string };

        // Assert
        expect(schema.name).toBe('span_labeling_response');
      });
    });

    describe('OpenAI options', () => {
      it('should include OpenAI-specific options', () => {
        // Act
        const options = getAdapterOptions('openai');

        // Assert
        expect(options.jsonMode).toBe(true);
        expect(options.logprobs).toBe(true);
        expect(options.topLogprobs).toBe(3);
        expect(options.retryOnValidationFailure).toBe(true);
        expect(options.maxRetries).toBe(2);
      });

      it('should NOT include Groq-specific options', () => {
        // Act
        const options = getAdapterOptions('openai');

        // Assert
        expect(options.enableSandwich).toBeUndefined();
        expect(options.enablePrefill).toBeUndefined();
      });

      it('should include OpenAI enriched schema', () => {
        // Act
        const options = getAdapterOptions('openai');
        const schema = options.schema as { strict?: boolean };

        // Assert
        expect(schema.strict).toBe(true);
      });
    });
  });

  // ============================================
  // Backward Compatibility Tests
  // ============================================

  describe('Backward Compatibility', () => {
    it('should export BASE_SYSTEM_PROMPT as Groq prompt', () => {
      // Assert
      expect(BASE_SYSTEM_PROMPT).toContain('[SECURITY_PREAMBLE]');
      expect(BASE_SYSTEM_PROMPT).toContain('camera.movement');
    });

    it('should export buildContextAwareSystemPrompt as alias', () => {
      // Assert
      expect(buildContextAwareSystemPrompt).toBe(buildSystemPrompt);
    });

    it('should export VALID_TAXONOMY_IDS', () => {
      // Assert
      expect(VALID_TAXONOMY_IDS).toBeDefined();
      expect(Array.isArray(VALID_TAXONOMY_IDS)).toBe(true);
      expect(VALID_TAXONOMY_IDS).toContain('camera.movement');
      expect(VALID_TAXONOMY_IDS).toContain('subject.identity');
    });

    it('should work with old function signatures (no useJsonSchema)', () => {
      // Act - Old signature: buildSystemPrompt(text, useRouter, provider)
      const result = buildSystemPrompt('test', false, 'groq');

      // Assert - Should work without useJsonSchema parameter
      expect(result).toBeDefined();
      expect(result).toContain('[SECURITY_PREAMBLE]');
    });

    it('should work with old message building signature', () => {
      // Act - Old signature: buildSpanLabelingMessages(text, includeFewShot, provider)
      const messages = buildSpanLabelingMessages('test', true, 'groq');

      // Assert - Should work without useJsonSchema parameter
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Integration Tests
  // ============================================

  describe('Integration', () => {
    it('should produce consistent messages across calls', () => {
      // Act
      const messages1 = buildSpanLabelingMessages('test input', true, 'groq', false);
      const messages2 = buildSpanLabelingMessages('test input', true, 'groq', false);

      // Assert
      expect(messages1).toEqual(messages2);
    });

    it('should produce different messages for different providers', () => {
      // Act
      const groqMessages = buildSpanLabelingMessages('test', false, 'groq');
      const openaiMessages = buildSpanLabelingMessages('test', false, 'openai');

      // Assert
      expect(groqMessages).not.toEqual(openaiMessages);
      // Groq has sandwich reminder, OpenAI doesn't
      expect(groqMessages.length).toBeGreaterThan(openaiMessages.length);
    });

    it('should produce optimized messages when useJsonSchema is true', () => {
      // Act
      const fullMessages = buildSpanLabelingMessages('test', false, 'groq', false);
      const optimizedMessages = buildSpanLabelingMessages('test', false, 'groq', true);

      // Assert - Optimized should have shorter system prompt and sandwich reminder
      const fullSystemPrompt = fullMessages[0].content;
      const optimizedSystemPrompt = optimizedMessages[0].content;
      expect(optimizedSystemPrompt.length).toBeLessThan(fullSystemPrompt.length);

      const fullSandwich = fullMessages[fullMessages.length - 1].content;
      const optimizedSandwich = optimizedMessages[optimizedMessages.length - 1].content;
      expect(optimizedSandwich.length).toBeLessThan(fullSandwich.length);
    });
  });
});
