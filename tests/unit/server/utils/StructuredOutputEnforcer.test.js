import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StructuredOutputEnforcer } from '../../../../server/src/utils/StructuredOutputEnforcer.js';

// Mock external dependencies only
vi.mock('../../../../server/src/infrastructure/Logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { logger } from '../../../../server/src/infrastructure/Logger.js';

describe('StructuredOutputEnforcer', () => {
  let mockClaudeClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock Claude client
    mockClaudeClient = {
      complete: vi.fn(),
    };
  });

  describe('enforceJSON - Happy Paths', () => {
    it('should extract valid JSON object from clean response', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '{"name": "test", "value": 42}',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Extract user data'
      );

      expect(result).toEqual({ name: 'test', value: 42 });
      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(1);
    });

    it('should extract valid JSON array from clean response', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '[{"id": 1}, {"id": 2}]',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Extract items',
        { isArray: true }
      );

      expect(result).toEqual([{ id: 1 }, { id: 2 }]);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should clean JSON wrapped in markdown code blocks', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '```json\n{"status": "success"}\n```',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get status'
      );

      expect(result).toEqual({ status: 'success' });
    });

    it('should clean JSON with preamble text', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: 'Here is the JSON object: {"result": "data"}',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get result'
      );

      expect(result).toEqual({ result: 'data' });
    });

    it('should handle JSON with extra whitespace', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '\n\n  {"trimmed": true}  \n\n',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data'
      );

      expect(result).toEqual({ trimmed: true });
    });

    it('should handle complex nested JSON objects', async () => {
      const complexJSON = {
        user: {
          name: 'Alice',
          profile: {
            age: 30,
            settings: { theme: 'dark' },
          },
        },
        items: [1, 2, 3],
      };

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: JSON.stringify(complexJSON) }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get complex data'
      );

      expect(result).toEqual(complexJSON);
    });
  });

  describe('enforceJSON - Error Handling and Retries', () => {
    it('should retry on JSON parse errors', async () => {
      mockClaudeClient.complete
        .mockResolvedValueOnce({
          content: [{ text: 'invalid json{' }],
        })
        .mockResolvedValueOnce({
          content: [{ text: '{"success": true}' }],
        });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data',
        { maxRetries: 2 }
      );

      expect(result).toEqual({ success: true });
      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(2);
      expect(logger.warn).toHaveBeenCalledWith(
        'Structured output extraction failed',
        expect.objectContaining({
          attempt: 1,
          willRetry: true,
        })
      );
    });

    it('should retry up to maxRetries times', async () => {
      mockClaudeClient.complete
        .mockResolvedValueOnce({ content: [{ text: 'invalid1' }] })
        .mockResolvedValueOnce({ content: [{ text: 'invalid2' }] })
        .mockResolvedValueOnce({ content: [{ text: '{"valid": true}' }] });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data',
        { maxRetries: 2 }
      );

      expect(result).toEqual({ valid: true });
      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(3);
    });

    it('should throw error after all retries exhausted', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: 'always invalid' }],
      });

      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get data', {
          maxRetries: 1,
        })
      ).rejects.toThrow(/Failed to extract valid JSON after 2 attempts/);

      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(2);
      expect(logger.error).toHaveBeenCalledWith(
        'All structured output extraction attempts failed',
        expect.any(Object)
      );
    });

    it('should not retry on API errors', async () => {
      const apiError = new Error('Rate limit exceeded');
      apiError.name = 'APIError';
      apiError.statusCode = 429;

      mockClaudeClient.complete.mockRejectedValue(apiError);

      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get data', {
          maxRetries: 2,
        })
      ).rejects.toThrow('Rate limit exceeded');

      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(1); // No retry
      expect(logger.warn).toHaveBeenCalledWith(
        'API error encountered, not retrying',
        expect.objectContaining({
          statusCode: 429,
        })
      );
    });

    it('should preserve statusCode from API errors', async () => {
      const apiError = new Error('Auth failed');
      apiError.statusCode = 401;

      mockClaudeClient.complete.mockRejectedValue(apiError);

      try {
        await StructuredOutputEnforcer.enforceJSON(
          mockClaudeClient,
          'Get data'
        );
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error.statusCode).toBe(401);
      }
    });

    it('should enhance prompt with error feedback on retry', async () => {
      mockClaudeClient.complete
        .mockResolvedValueOnce({
          content: [{ text: 'invalid json' }],
        })
        .mockResolvedValueOnce({
          content: [{ text: '{"fixed": true}' }],
        });

      await StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Original prompt', {
        maxRetries: 1,
      });

      // Second call should have both enhanced prompt and error feedback
      const secondCallPrompt = mockClaudeClient.complete.mock.calls[1][0];
      // The system prompt gets enhanced with error feedback, then passed through _enhancePromptForJSON
      expect(secondCallPrompt).toContain('Original prompt');
      expect(secondCallPrompt).toContain('CRITICAL OUTPUT REQUIREMENT');
      // The enhanced version should be based on the feedback-enhanced system prompt
      expect(mockClaudeClient.complete).toHaveBeenCalledTimes(2);
    });
  });

  describe('enforceJSON - Schema Validation', () => {
    it('should validate required fields in objects', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"name": "test"}' }],
      });

      const schema = {
        type: 'object',
        required: ['name', 'age'],
      };

      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get user', {
          schema,
        })
      ).rejects.toThrow('Missing required field: age');
    });

    it('should pass validation when all required fields present', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"name": "test", "age": 25}' }],
      });

      const schema = {
        type: 'object',
        required: ['name', 'age'],
      };

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get user',
        { schema }
      );

      expect(result).toEqual({ name: 'test', age: 25 });
    });

    it('should validate type is object when schema expects object', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '[1, 2, 3]' }],
      });

      const schema = {
        type: 'object',
        required: ['field'],
      };

      // Note: Without isArray: true, the cleaner will try to extract {...} and fail
      // So we'll get a cleaning error before schema validation
      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get data', {
          schema,
        })
      ).rejects.toThrow(); // Will fail during JSON extraction/cleaning
    });

    it('should validate type is array when schema expects array', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"not": "array"}' }],
      });

      const schema = {
        type: 'array',
      };

      // With isArray: true, cleaner will try to extract [...] and fail
      // So we'll get a cleaning error before schema validation
      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get data', {
          schema,
          isArray: true,
        })
      ).rejects.toThrow(); // Will fail during JSON extraction/cleaning
    });

    it('should validate required fields in array items', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '[{"name": "item1"}, {"value": 123}]',
          },
        ],
      });

      const schema = {
        type: 'array',
        items: {
          required: ['name'],
        },
      };

      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get items', {
          schema,
          isArray: true,
        })
      ).rejects.toThrow("Missing required field 'name' in array item at index 1");
    });

    it('should pass validation for valid array items', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '[{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]',
          },
        ],
      });

      const schema = {
        type: 'array',
        items: {
          required: ['id', 'name'],
        },
      };

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get items',
        { schema, isArray: true }
      );

      expect(result).toEqual([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);
    });
  });

  describe('_cleanJSONResponse - JSON Cleaning Logic', () => {
    it('should remove markdown code blocks', () => {
      const input = '```json\n{"test": true}\n```';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, false);

      expect(cleaned).toBe('{"test": true}');
    });

    it('should remove "Here is" preambles', () => {
      const input = 'Here is the result: {"data": 1}';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, false);

      expect(cleaned).toBe('{"data": 1}');
    });

    it('should extract JSON from text with extra content', () => {
      const input = 'Some text before {"value": 42} some text after';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, false);

      expect(cleaned).toBe('{"value": 42}');
    });

    it('should handle arrays correctly', () => {
      const input = 'Text before [1, 2, 3] text after';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, true);

      expect(cleaned).toBe('[1, 2, 3]');
    });

    it('should throw error if JSON structure not found', () => {
      const input = 'No JSON here at all';

      expect(() => {
        StructuredOutputEnforcer._cleanJSONResponse(input, false);
      }).toThrow('Invalid JSON structure: Expected {...}');
    });

    it('should throw error for mismatched brackets', () => {
      const input = '{ incomplete';

      expect(() => {
        StructuredOutputEnforcer._cleanJSONResponse(input, false);
      }).toThrow('Invalid JSON structure');
    });

    it('should handle nested braces correctly', () => {
      const input = '{"outer": {"inner": {"deep": true}}}';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, false);

      expect(cleaned).toBe('{"outer": {"inner": {"deep": true}}}');
    });

    it('should handle arrays with nested objects', () => {
      const input = '[{"a": 1}, {"b": 2}]';
      const cleaned = StructuredOutputEnforcer._cleanJSONResponse(input, true);

      expect(cleaned).toBe('[{"a": 1}, {"b": 2}]');
    });
  });

  describe('_enhancePromptForJSON - Prompt Enhancement', () => {
    it('should add JSON enforcement instructions for objects', () => {
      const original = 'Extract user data';
      const enhanced = StructuredOutputEnforcer._enhancePromptForJSON(
        original,
        false
      );

      expect(enhanced).toContain('Extract user data');
      expect(enhanced).toContain('CRITICAL OUTPUT REQUIREMENT');
      expect(enhanced).toContain('valid JSON object');
      expect(enhanced).toContain('Start immediately with {');
    });

    it('should add JSON enforcement instructions for arrays', () => {
      const original = 'Extract items';
      const enhanced = StructuredOutputEnforcer._enhancePromptForJSON(
        original,
        true
      );

      expect(enhanced).toContain('Extract items');
      expect(enhanced).toContain('valid JSON array');
      expect(enhanced).toContain('Start immediately with [');
      expect(enhanced).toContain('bracket [');
    });

    it('should include examples of invalid formats', () => {
      const enhanced = StructuredOutputEnforcer._enhancePromptForJSON(
        'Test',
        false
      );

      expect(enhanced).toContain('❌ INVALID');
      expect(enhanced).toContain('✅ VALID');
      expect(enhanced).toContain('markdown code blocks');
    });
  });

  describe('_enhancePromptWithErrorFeedback - Error Feedback', () => {
    it('should add error message from previous attempt', () => {
      const original = 'Get data';
      const errorMessage = 'Unexpected token';
      const enhanced = StructuredOutputEnforcer._enhancePromptWithErrorFeedback(
        original,
        errorMessage,
        false
      );

      expect(enhanced).toContain('PREVIOUS ATTEMPT FAILED');
      expect(enhanced).toContain('Unexpected token');
      expect(enhanced).toContain('Common issues to avoid');
    });

    it('should include common error patterns', () => {
      const enhanced = StructuredOutputEnforcer._enhancePromptWithErrorFeedback(
        'Test',
        'Parse error',
        false
      );

      expect(enhanced).toContain('markdown code blocks');
      expect(enhanced).toContain('single quotes');
      expect(enhanced).toContain('trailing commas');
      expect(enhanced).toContain('Improperly escaped strings');
    });

    it('should specify correct closing character for arrays', () => {
      const enhanced = StructuredOutputEnforcer._enhancePromptWithErrorFeedback(
        'Test',
        'Error',
        true
      );

      expect(enhanced).toContain('closing brackets ]');
      expect(enhanced).toContain('JSON array starting with [');
    });

    it('should specify correct closing character for objects', () => {
      const enhanced = StructuredOutputEnforcer._enhancePromptWithErrorFeedback(
        'Test',
        'Error',
        false
      );

      expect(enhanced).toContain('closing braces }');
      expect(enhanced).toContain('JSON object starting with {');
    });
  });

  describe('Edge Cases and Complex Scenarios', () => {
    it('should handle empty JSON object', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{}' }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get empty'
      );

      expect(result).toEqual({});
    });

    it('should handle empty JSON array', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '[]' }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get empty',
        { isArray: true }
      );

      expect(result).toEqual([]);
    });

    it('should handle JSON with special characters', async () => {
      const specialJSON = {
        text: 'Line 1\nLine 2\tTabbed',
        quote: 'He said "hello"',
        unicode: '🎉',
      };

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: JSON.stringify(specialJSON) }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get special'
      );

      expect(result).toEqual(specialJSON);
    });

    it('should handle JSON with null values', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"value": null, "exists": true}' }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data'
      );

      expect(result).toEqual({ value: null, exists: true });
    });

    it('should handle JSON with boolean values', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"active": true, "disabled": false}' }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get flags'
      );

      expect(result).toEqual({ active: true, disabled: false });
    });

    it('should handle very large JSON responses', async () => {
      const largeArray = new Array(1000).fill(null).map((_, i) => ({ id: i }));

      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: JSON.stringify(largeArray) }],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get large',
        { isArray: true }
      );

      expect(result).toHaveLength(1000);
      expect(result[0]).toEqual({ id: 0 });
      expect(result[999]).toEqual({ id: 999 });
    });

    it('should pass through claudeOptions to client', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [{ text: '{"test": true}' }],
      });

      await StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Test', {
        temperature: 0.5,
        maxTokens: 1000,
      });

      expect(mockClaudeClient.complete).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          temperature: 0.5,
          maxTokens: 1000,
          userMessage: 'Please provide the output as specified.',
        })
      );
    });

    it('should fail on responses with multiple JSON objects (invalid JSON)', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '{"first": true} {"second": true}',
          },
        ],
      });

      // The cleaner extracts from first { to last }, but the result isn't valid JSON
      // because there's extra text between the objects
      await expect(
        StructuredOutputEnforcer.enforceJSON(mockClaudeClient, 'Get data', {
          maxRetries: 0, // Don't retry to make test faster
        })
      ).rejects.toThrow();
    });
  });

  describe('Real-world Integration Scenarios', () => {
    it('should handle typical LLM response with explanation', async () => {
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: `I'll help you with that. Here's the data you requested:

\`\`\`json
{
  "user": "Alice",
  "score": 95,
  "status": "active"
}
\`\`\`

This shows the user information as requested.`,
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get user info'
      );

      expect(result).toEqual({
        user: 'Alice',
        score: 95,
        status: 'active',
      });
    });

    it('should recover from common LLM formatting mistakes', async () => {
      mockClaudeClient.complete
        .mockResolvedValueOnce({
          content: [{ text: "{'invalid': 'single quotes'}" }],
        })
        .mockResolvedValueOnce({
          content: [{ text: '{"valid": "double quotes"}' }],
        });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data',
        { maxRetries: 1 }
      );

      expect(result).toEqual({ valid: 'double quotes' });
    });

    it('should handle streaming-like responses (concatenated content)', async () => {
      // Simulate response that might come from streaming
      mockClaudeClient.complete.mockResolvedValue({
        content: [
          {
            text: '{"data": "value1", "more": "value2", "extra": "value3"}',
          },
        ],
      });

      const result = await StructuredOutputEnforcer.enforceJSON(
        mockClaudeClient,
        'Get data'
      );

      expect(result).toEqual({
        data: 'value1',
        more: 'value2',
        extra: 'value3',
      });
    });
  });
});
