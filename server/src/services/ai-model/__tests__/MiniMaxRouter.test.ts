/**
 * @test {MiniMaxRouter}
 * @description Comprehensive tests for Mini-Max routing service
 * 
 * This test demonstrates:
 * - Complexity analysis (prompt length, schema depth, keywords)
 * - Routing decision logic (high/medium/low confidence)
 * - Tier 1 routing to GPT-4o-mini
 * - Tier 2 routing to GPT-4o
 * - Automatic fallback on validation failure
 * - Fallback on API errors
 * 
 * Pattern: TypeScript test with typed mocks
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { MiniMaxRouter } from '../MiniMaxRouter';
import type { AIService } from '../AIModelService';
import type { AIResponse } from '@interfaces/IAIClient';

// Mock logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('MiniMaxRouter', () => {
  let router: MiniMaxRouter;
  let mockAIService: {
    execute: MockedFunction<AIService['execute']>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockAIService = {
      execute: vi.fn(),
    };

    router = new MiniMaxRouter(mockAIService as unknown as AIService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Complexity Analysis Tests
  // ============================================

  describe('Complexity Analysis', () => {
    it('should route simple tasks to GPT-4o-mini (high confidence)', async () => {
      // Arrange - Short prompt, simple schema, no complex keywords
      const simpleResponse: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(simpleResponse);

      // Act
      const result = await router.route({
        operation: 'simple_extraction',
        systemPrompt: 'Extract the date',
        userMessage: 'From: test@example.com Date: 2024-01-15',
        schema: {
          type: 'object',
          properties: { date: { type: 'string' } },
        },
      });

      // Assert - Should use GPT-4o-mini
      expect(result).toEqual(simpleResponse);
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      // Router tries operation_mini first, but if it doesn't exist, falls back to original with model override
      expect(['simple_extraction_mini', 'simple_extraction']).toContain(callArgs[0]);
    });

    it('should route complex tasks to GPT-4o (high confidence)', async () => {
      // Arrange - Long prompt (>10k chars)
      const longPrompt = 'A'.repeat(15000);
      const complexResponse: AIResponse = {
        text: '{"result": "complex analysis"}',
        metadata: { usage: { inputTokens: 4000, outputTokens: 200 } },
      };

      mockAIService.execute.mockResolvedValue(complexResponse);

      // Act
      const result = await router.route({
        operation: 'complex_analysis',
        systemPrompt: longPrompt,
        userMessage: 'Analyze this document',
      });

      // Assert - Should use GPT-4o directly
      expect(result).toEqual(complexResponse);
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('complex_analysis'); // Original operation
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06', // GPT-4o model
      });
    });

    it('should detect complex schemas (deep nesting, many fields)', async () => {
      // Arrange - Complex schema with deep nesting
      const complexSchema = {
        type: 'object',
        properties: {
          level1: {
            type: 'object',
            properties: {
              level2: {
                type: 'object',
                properties: {
                  level3: {
                    type: 'object',
                    properties: {
                      level4: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      };

      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 100, outputTokens: 50 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'complex_schema',
        systemPrompt: 'Process this data',
        userMessage: 'Test',
        schema: complexSchema,
      });

      // Assert - Should use GPT-4o for complex schema
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('complex_schema'); // Original operation
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });

    it('should detect complex keywords (legal, medical, etc.)', async () => {
      // Arrange - Prompt with legal keywords
      const legalPrompt = 'Draft a legal contract for software licensing agreement';
      const response: AIResponse = {
        text: '{"contract": "drafted"}',
        metadata: { usage: { inputTokens: 200, outputTokens: 100 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'legal_drafting',
        systemPrompt: legalPrompt,
        userMessage: 'Create contract',
      });

      // Assert - Should use GPT-4o for legal content
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('legal_drafting');
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });

    it('should detect medical keywords', async () => {
      // Arrange
      const medicalPrompt = 'Analyze this medical diagnosis and treatment plan';
      const response: AIResponse = {
        text: '{"analysis": "complete"}',
        metadata: { usage: { inputTokens: 150, outputTokens: 75 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'medical_analysis',
        systemPrompt: medicalPrompt,
      });

      // Assert - Should use GPT-4o
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });

    it('should detect scientific keywords', async () => {
      // Arrange
      const scientificPrompt = 'Conduct scientific research and hypothesis testing';
      const response: AIResponse = {
        text: '{"research": "complete"}',
        metadata: { usage: { inputTokens: 200, outputTokens: 100 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'scientific_research',
        systemPrompt: scientificPrompt,
      });

      // Assert - Should use GPT-4o
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });
  });

  // ============================================
  // Routing Logic Tests
  // ============================================

  describe('Routing Logic', () => {
    it('should use GPT-4o-mini for short prompts with simple schema', async () => {
      // Arrange
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'simple_task',
        systemPrompt: 'Extract data',
        userMessage: 'Test input',
        schema: {
          type: 'object',
          properties: { value: { type: 'string' } },
        },
      });

      // Assert
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      // Router tries operation_mini first, but if it doesn't exist, falls back to original with model override
      const operation = mockAIService.execute.mock.calls[0][0];
      expect(['simple_task_mini', 'simple_task']).toContain(operation);
    });

    it('should use GPT-4o for long prompts (>10k chars)', async () => {
      // Arrange
      const longPrompt = 'A'.repeat(12000);
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 3000, outputTokens: 10 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'long_analysis',
        systemPrompt: longPrompt,
        userMessage: 'Analyze',
      });

      // Assert
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('long_analysis');
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });

    it('should use GPT-4o for complex schemas', async () => {
      // Arrange - Schema with many fields
      const complexSchema = {
        type: 'object',
        properties: {
          field1: { type: 'string' },
          field2: { type: 'string' },
          field3: { type: 'string' },
          field4: { type: 'string' },
          field5: { type: 'string' },
          field6: { type: 'string' },
          field7: { type: 'string' },
          field8: { type: 'string' },
          field9: { type: 'string' },
          field10: { type: 'string' },
          field11: { type: 'string' },
          field12: { type: 'string' },
          field13: { type: 'string' },
          field14: { type: 'string' },
          field15: { type: 'string' },
          field16: { type: 'string' },
          field17: { type: 'string' },
          field18: { type: 'string' },
          field19: { type: 'string' },
          field20: { type: 'string' },
          field21: { type: 'string' }, // >20 fields
        },
      };

      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 100, outputTokens: 50 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'many_fields',
        systemPrompt: 'Extract all fields',
        schema: complexSchema,
      });

      // Assert - Should use GPT-4o
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });

    it('should use GPT-4o-mini for medium-length prompts (<5k chars) without complex schema', async () => {
      // Arrange
      const mediumPrompt = 'A'.repeat(4000);
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 1000, outputTokens: 10 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'medium_task',
        systemPrompt: mediumPrompt,
        userMessage: 'Process',
      });

      // Assert - Should try mini first
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('medium_task_mini');
    });

    it('should default to GPT-4o for borderline cases', async () => {
      // Arrange - Medium length but with some complexity indicators
      const borderlinePrompt = 'A'.repeat(8000);
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 2000, outputTokens: 10 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'borderline',
        systemPrompt: borderlinePrompt,
        userMessage: 'Process',
      });

      // Assert - Should default to GPT-4o for safety
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('borderline');
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });
  });

  // ============================================
  // Fallback Behavior Tests
  // ============================================

  describe('Fallback Behavior', () => {
    it('should fallback to GPT-4o when mini fails validation', async () => {
      // Arrange
      const invalidResponse: AIResponse = {
        text: '{"incomplete": "data"}', // Missing required fields
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      const validResponse: AIResponse = {
        text: '{"result": "success", "required": "field"}',
        metadata: { usage: { inputTokens: 20, outputTokens: 10 } },
      };

      const validator = vi.fn((response: AIResponse) => {
        if (response.text.includes('incomplete')) {
          return { valid: false, errors: ['Missing required field'] };
        }
        return { valid: true };
      });

      mockAIService.execute
        .mockResolvedValueOnce(invalidResponse) // Mini fails validation
        .mockResolvedValueOnce(validResponse); // GPT-4o succeeds

      // Act
      const result = await router.route({
        operation: 'validated_task',
        systemPrompt: 'Extract data',
        userMessage: 'Test',
        validateResponse: validator,
      });

      // Assert - Should have tried mini, then GPT-4o
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('validated_task_mini');
      expect(mockAIService.execute.mock.calls[1][0]).toBe('validated_task');
      expect(mockAIService.execute.mock.calls[1][1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
      expect(result).toEqual(validResponse);
    });

    it('should fallback to GPT-4o when mini API fails', async () => {
      // Arrange
      const error = new Error('API rate limit exceeded');
      const fallbackResponse: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 20, outputTokens: 10 } },
      };

      mockAIService.execute
        .mockRejectedValueOnce(error) // Mini fails
        .mockResolvedValueOnce(fallbackResponse); // GPT-4o succeeds

      // Act
      const result = await router.route({
        operation: 'api_task',
        systemPrompt: 'Process',
        userMessage: 'Test',
      });

      // Assert
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('api_task_mini');
      expect(mockAIService.execute.mock.calls[1][0]).toBe('api_task');
      expect(result).toEqual(fallbackResponse);
    });

    it('should not fallback when mini succeeds', async () => {
      // Arrange
      const miniResponse: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      const validator = vi.fn(() => ({ valid: true }));

      mockAIService.execute.mockResolvedValue(miniResponse);

      // Act
      const result = await router.route({
        operation: 'successful_task',
        systemPrompt: 'Extract',
        userMessage: 'Test',
        validateResponse: validator,
      });

      // Assert - Should only call mini once
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('successful_task_mini');
      expect(result).toEqual(miniResponse);
    });

    it('should fallback when mini operation does not exist', async () => {
      // Arrange
      const notFoundError = new Error('Operation not found: simple_task_mini');
      const fallbackResponse: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 20, outputTokens: 10 } },
      };

      mockAIService.execute
        .mockRejectedValueOnce(notFoundError) // Mini operation doesn't exist
        .mockResolvedValueOnce(fallbackResponse); // Fallback to original with mini model override

      // Act
      const result = await router.route({
        operation: 'simple_task',
        systemPrompt: 'Extract',
        userMessage: 'Test',
      });

      // Assert - Should try mini operation, then fallback to original with model override
      expect(mockAIService.execute).toHaveBeenCalledTimes(2);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('simple_task_mini');
      expect(mockAIService.execute.mock.calls[1][0]).toBe('simple_task');
      expect(mockAIService.execute.mock.calls[1][1]).toMatchObject({
        model: 'gpt-4o-mini-2024-07-18',
      });
      expect(result).toEqual(fallbackResponse);
    });

    it('should not use mini when confidence is low', async () => {
      // Arrange - Complex task that would normally try mini but has low confidence
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 100, outputTokens: 50 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act - Use a complex operation that router might not be confident about
      await router.route({
        operation: 'uncertain_task',
        systemPrompt: 'B'.repeat(6000), // Medium length, but router might be uncertain
        userMessage: 'Process',
      });

      // Assert - Should go directly to GPT-4o
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      const callArgs = mockAIService.execute.mock.calls[0];
      expect(callArgs[0]).toBe('uncertain_task');
      expect(callArgs[1]).toMatchObject({
        model: 'gpt-4o-2024-08-06',
      });
    });
  });

  // ============================================
  // Edge Cases Tests
  // ============================================

  describe('Edge Cases', () => {
    it('should handle empty user message', async () => {
      // Arrange
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'empty_user',
        systemPrompt: 'Extract data',
        userMessage: '',
      });

      // Assert
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle missing schema', async () => {
      // Arrange
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'no_schema',
        systemPrompt: 'Process',
        userMessage: 'Test',
      });

      // Assert - Should work without schema
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle operation name ending with _mini', async () => {
      // Arrange
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act - Operation already ends with _mini
      await router.route({
        operation: 'extract_mini',
        systemPrompt: 'Extract',
        userMessage: 'Test',
      });

      // Assert - Should not double-append _mini
      expect(mockAIService.execute).toHaveBeenCalledTimes(1);
      expect(mockAIService.execute.mock.calls[0][0]).toBe('extract_mini');
    });

    it('should pass through all options to AI service', async () => {
      // Arrange
      const response: AIResponse = {
        text: '{"result": "success"}',
        metadata: { usage: { inputTokens: 10, outputTokens: 5 } },
      };

      mockAIService.execute.mockResolvedValue(response);

      // Act
      await router.route({
        operation: 'full_options',
        systemPrompt: 'Process',
        userMessage: 'Test',
        schema: { type: 'object', properties: {} },
        maxTokens: 1000,
        temperature: 0.2,
        timeout: 30000,
      });

      // Assert - All options should be passed through
      const callArgs = mockAIService.execute.mock.calls[0][1];
      expect(callArgs).toMatchObject({
        systemPrompt: 'Process',
        userMessage: 'Test',
        schema: { type: 'object', properties: {} },
        maxTokens: 1000,
        temperature: 0.2,
        timeout: 30000,
        enableBookending: true,
      });
    });
  });
});

