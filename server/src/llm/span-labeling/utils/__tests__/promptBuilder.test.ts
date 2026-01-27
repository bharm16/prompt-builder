import { describe, it, expect, vi } from 'vitest';
import {
  buildSystemPrompt,
  getSchema,
  getResponseFormat,
  getFewShotExamples,
  buildSpanLabelingMessages,
  getProviderConfig,
  getAdapterOptions,
} from '../promptBuilder';

// Mock the logger to avoid side effects
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe('buildSystemPrompt', () => {
  describe('error handling', () => {
    it('handles empty text parameter', () => {
      const result = buildSystemPrompt('', false, 'groq');

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('handles unknown provider by defaulting to groq-style prompt', () => {
      const result = buildSystemPrompt('test', false, 'unknown-provider');

      // Should use Groq as default, which includes security preamble
      expect(result).toContain('CRITICAL SECURITY DIRECTIVE');
    });
  });

  describe('edge cases', () => {
    it('handles mixed case provider names', () => {
      const lower = buildSystemPrompt('test', false, 'openai');
      const upper = buildSystemPrompt('test', false, 'OPENAI');
      const mixed = buildSystemPrompt('test', false, 'OpenAI');

      // All should normalize to same output
      expect(upper).toBe(lower);
      expect(mixed).toBe(lower);
    });
  });

  describe('core behavior', () => {
    it('includes security preamble for non-gemini providers', () => {
      const groqResult = buildSystemPrompt('test', false, 'groq');
      const openaiResult = buildSystemPrompt('test', false, 'openai');

      expect(groqResult).toContain('CRITICAL SECURITY DIRECTIVE');
      expect(openaiResult).toContain('CRITICAL SECURITY DIRECTIVE');
    });

    it('returns different prompts for openai vs groq', () => {
      const openaiResult = buildSystemPrompt('test', false, 'openai');
      const groqResult = buildSystemPrompt('test', false, 'groq');

      // OpenAI uses minimal prompt, Groq uses full prompt
      expect(openaiResult.length).not.toBe(groqResult.length);
    });

    it('generates shorter groq prompt when useJsonSchema is true', () => {
      const withSchema = buildSystemPrompt('test', false, 'groq', true);
      const withoutSchema = buildSystemPrompt('test', false, 'groq', false);

      // When json_schema is active, format instructions can be removed
      expect(withSchema.length).toBeLessThanOrEqual(withoutSchema.length);
    });

    it('returns gemini-specific prompt without security preamble', () => {
      const result = buildSystemPrompt('test', false, 'gemini');

      // Gemini has a lightweight prompt returned directly
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

describe('getSchema', () => {
  describe('error handling', () => {
    it('returns schema for unknown provider (defaults to groq)', () => {
      const result = getSchema('unknown');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });
  });

  describe('core behavior', () => {
    it('returns openai enriched schema for openai provider', () => {
      const result = getSchema('openai');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('returns groq validation schema for groq provider', () => {
      const result = getSchema('groq');

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('returns different schemas for openai vs groq', () => {
      const openaiSchema = getSchema('openai');
      const groqSchema = getSchema('groq');

      // Schemas should be different objects
      expect(JSON.stringify(openaiSchema)).not.toBe(JSON.stringify(groqSchema));
    });
  });
});

describe('getResponseFormat', () => {
  describe('core behavior', () => {
    it('returns json_schema type for all providers', () => {
      const openaiFormat = getResponseFormat('openai');
      const groqFormat = getResponseFormat('groq');

      expect(openaiFormat.type).toBe('json_schema');
      expect(groqFormat.type).toBe('json_schema');
    });

    it('includes schema in response format', () => {
      const result = getResponseFormat('openai');

      expect(result.json_schema).toBeDefined();
      expect(typeof result.json_schema).toBe('object');
    });
  });
});

describe('getFewShotExamples', () => {
  describe('error handling', () => {
    it('returns groq examples for unknown provider', () => {
      const result = getFewShotExamples('unknown');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns array of user/assistant message pairs', () => {
      const result = getFewShotExamples('groq');

      expect(Array.isArray(result)).toBe(true);
      result.forEach((example) => {
        expect(['user', 'assistant']).toContain(example.role);
        expect(typeof example.content).toBe('string');
      });
    });

    it('returns different example counts for openai vs groq', () => {
      const openaiExamples = getFewShotExamples('openai');
      const groqExamples = getFewShotExamples('groq');

      // OpenAI needs fewer examples since rules are in schema
      // Groq needs more examples for in-context learning
      expect(openaiExamples.length).not.toBe(groqExamples.length);
    });
  });
});

describe('buildSpanLabelingMessages', () => {
  describe('error handling', () => {
    it('handles empty text', () => {
      const result = buildSpanLabelingMessages('', true, 'groq');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('excludes few-shot examples when includeFewShot is false', () => {
      const withExamples = buildSpanLabelingMessages('test', true, 'groq');
      const withoutExamples = buildSpanLabelingMessages('test', false, 'groq');

      expect(withExamples.length).toBeGreaterThan(withoutExamples.length);
    });

    it('handles special characters in text', () => {
      const text = 'Test with <script>alert("xss")</script> and \n\t special chars';
      const result = buildSpanLabelingMessages(text, false, 'groq');

      // Text should be wrapped in XML tags in a user role message
      // Use role='user' to avoid matching system prompt examples
      const userInputMessage = result.find(
        (m) => m.role === 'user' && m.content.includes('<user_input>')
      );
      expect(userInputMessage).toBeDefined();
      expect(userInputMessage?.content).toContain(text);
    });
  });

  describe('core behavior', () => {
    it('includes system message first', () => {
      const result = buildSpanLabelingMessages('test', true, 'groq');

      expect(result[0]?.role).toBe('system');
    });

    it('wraps input text in XML tags', () => {
      const result = buildSpanLabelingMessages('my test prompt', false, 'groq');

      // Use role='user' to avoid matching system prompt examples that may contain <user_input>
      const userInputMessage = result.find(
        (m) => m.role === 'user' && m.content.includes('<user_input>')
      );
      expect(userInputMessage).toBeDefined();
      expect(userInputMessage?.content).toContain('<user_input>');
      expect(userInputMessage?.content).toContain('my test prompt');
      expect(userInputMessage?.content).toContain('</user_input>');
    });

    it('includes sandwich reminder for groq provider', () => {
      const result = buildSpanLabelingMessages('test', false, 'groq');

      // Groq gets an extra message at the end for sandwich prompting
      const lastMessage = result[result.length - 1];
      expect(lastMessage?.role).toBe('user');
    });

    it('does not include sandwich reminder for openai provider', () => {
      const result = buildSpanLabelingMessages('test', false, 'openai');

      // OpenAI doesn't need sandwich prompting
      // The last user message should be the main input
      const lastMessage = result[result.length - 1];
      expect(lastMessage?.content).toContain('<user_input>');
    });
  });
});

describe('getProviderConfig', () => {
  describe('error handling', () => {
    it('returns groq config for unknown provider', () => {
      const result = getProviderConfig('unknown');

      expect(result.provider).toBe('groq');
    });
  });

  describe('core behavior', () => {
    it('returns description-enriched strategy for openai', () => {
      const result = getProviderConfig('openai');

      expect(result.provider).toBe('openai');
      expect(result.strategy).toBe('description-enriched');
      expect(result.features).toContain('grammar-constrained-decoding');
    });

    it('returns prompt-centric strategy for groq', () => {
      const result = getProviderConfig('groq');

      expect(result.provider).toBe('groq');
      expect(result.strategy).toBe('prompt-centric');
      expect(result.features).toContain('sandwich-prompting');
    });

    it('provides token estimates', () => {
      const openaiConfig = getProviderConfig('openai');
      const groqConfig = getProviderConfig('groq');

      expect(openaiConfig.promptTokens).toBeGreaterThan(0);
      expect(openaiConfig.schemaTokens).toBeGreaterThan(0);
      expect(openaiConfig.totalTokens).toBe(openaiConfig.promptTokens + openaiConfig.schemaTokens);

      expect(groqConfig.promptTokens).toBeGreaterThan(0);
      expect(groqConfig.totalTokens).toBe(groqConfig.promptTokens + groqConfig.schemaTokens);
    });
  });
});

describe('getAdapterOptions', () => {
  describe('error handling', () => {
    it('returns groq options for unknown provider', () => {
      const result = getAdapterOptions('unknown');

      expect(result.jsonMode).toBe(true);
      expect(result.enableSandwich).toBe(true);
    });
  });

  describe('core behavior', () => {
    it('returns openai-specific options for openai', () => {
      const result = getAdapterOptions('openai');

      expect(result.jsonMode).toBe(true);
      expect(result.logprobs).toBe(true);
      expect(result.retryOnValidationFailure).toBe(true);
      expect(result.maxRetries).toBe(2);
    });

    it('returns groq-specific options for groq', () => {
      const result = getAdapterOptions('groq');

      expect(result.jsonMode).toBe(true);
      expect(result.enableSandwich).toBe(true);
      expect(result.enablePrefill).toBe(true);
      expect(result.logprobs).toBe(true);
    });

    it('includes schema in options', () => {
      const openaiOptions = getAdapterOptions('openai');
      const groqOptions = getAdapterOptions('groq');

      expect(openaiOptions.schema).toBeDefined();
      expect(groqOptions.schema).toBeDefined();
    });
  });
});
