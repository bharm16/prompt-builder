/**
 * @test {GroqLlamaAdapter}
 * @description Tests for Groq/Llama 3 adapter with optimizations
 * 
 * Test Coverage:
 * - Stop sequences for structured outputs (Llama 3 PDF Section 4.3)
 * - Temperature configuration (0.1 for structured, 0.7 for creative)
 * - Sandwich prompting and pre-fill assistant
 * - Metadata tracking of optimizations
 * - Streaming with same optimizations
 * 
 * Pattern: TypeScript test with typed mocks following Llama 3 best practices
 */

import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { GroqLlamaAdapter } from '../GroqLlamaAdapter';
import { APIError, TimeoutError } from '../../LLMClient';

// Mock logger
vi.mock('@infrastructure/Logger', () => ({
  logger: {
    child: vi.fn(function child() { return this; }),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock response validator
vi.mock('../ResponseValidator.js', () => ({
  validateLLMResponse: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
}));

describe('GroqLlamaAdapter', () => {
  let adapter: GroqLlamaAdapter;
  let mockFetch: MockedFunction<typeof fetch>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    adapter = new GroqLlamaAdapter({
      apiKey: 'test-groq-api-key',
      baseURL: 'https://api.groq.com/openai/v1',
      defaultModel: 'llama-3.1-8b-instant',
      defaultTimeout: 30000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Constructor Tests
  // ============================================

  describe('Constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(adapter).toBeDefined();
      expect(adapter.capabilities).toEqual({
        streaming: true,
        jsonMode: true,
        jsonSchema: true,
        logprobs: true,
        seed: true,
      });
    });

    it('should throw error if API key is missing', () => {
      expect(() => {
        new GroqLlamaAdapter({
          apiKey: '',
          baseURL: 'https://api.groq.com/openai/v1',
          defaultModel: 'llama-3.1-8b-instant',
        });
      }).toThrow('Groq API key required');
    });
  });

  // ============================================
  // Stop Sequences Tests (Llama 3 PDF Section 4.3)
  // ============================================

  describe('Stop Sequences', () => {
    it('should add stop sequences for structured output (jsonMode)', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toEqual(['```', '\n\n\n', 'Note:', 'I hope']);
    });

    it('should add stop sequences for structured output (schema)', async () => {
      // Arrange
      const schema = {
        name: 'test_response',
        schema: { type: 'object', properties: { result: { type: 'string' } } },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        schema,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toEqual(['```', '\n\n\n', 'Note:', 'I hope']);
    });

    it('should add stop sequences for structured output (responseFormat)', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        responseFormat: { type: 'json_object' },
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toEqual(['```', '\n\n\n', 'Note:', 'I hope']);
    });

    it('should NOT add stop sequences for creative/non-structured output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Creative response here' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Be creative', {
        userMessage: 'Write a story',
        // No jsonMode, no schema, no responseFormat
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toBeUndefined();
    });
  });

  // ============================================
  // Temperature Configuration Tests (Section 4.1)
  // ============================================

  describe('Temperature Configuration', () => {
    it('should use temperature 0.1 for structured outputs (jsonMode)', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.temperature).toBe(0.1);
    });

    it('should use temperature 0.7 for creative/non-structured outputs', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Creative response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Be creative', {
        userMessage: 'Write a story',
        // No jsonMode
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.temperature).toBe(0.7);
    });

    it('should respect explicit temperature override', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
        temperature: 0.5, // Explicit override
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.temperature).toBe(0.5);
    });
  });

  // ============================================
  // Top-P Configuration Tests
  // ============================================

  describe('Top-P Configuration', () => {
    it('should use top_p 0.95 for structured outputs', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.top_p).toBe(0.95);
    });

    it('should use top_p 0.9 for creative outputs', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Creative response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Be creative', {
        userMessage: 'Write a story',
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.top_p).toBe(0.9);
    });
  });

  // ============================================
  // Repetition Penalty Tests (Section 4.2)
  // ============================================

  describe('Repetition Penalty', () => {
    it('should disable repetition penalties for structured output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.frequency_penalty).toBe(0);
      expect(callBody.presence_penalty).toBe(0);
    });

    it('should NOT set repetition penalties for creative output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Creative response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Be creative', {
        userMessage: 'Write a story',
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.frequency_penalty).toBeUndefined();
      expect(callBody.presence_penalty).toBeUndefined();
    });
  });

  // ============================================
  // Metadata Tracking Tests
  // ============================================

  describe('Metadata Tracking', () => {
    it('should include new optimizations in metadata', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      const result = await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      expect(result.metadata.optimizations).toContain('llama3-temp-0.1');
      expect(result.metadata.optimizations).toContain('top_p-0.95');
      expect(result.metadata.optimizations).toContain('stop-sequences');
      expect(result.metadata.optimizations).toContain('sandwich-prompting');
      expect(result.metadata.optimizations).toContain('xml-wrapping');
      expect(result.metadata.optimizations).toContain('prefill-assistant');
    });

    it('should include provider as groq', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      const result = await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      expect(result.metadata.provider).toBe('groq');
    });
  });

  // ============================================
  // Streaming Tests
  // ============================================

  describe('Streaming', () => {
    it('should add stop sequences for streaming structured output', async () => {
      // Arrange
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"{\\"result\\""}}]}\n\n'),
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":": \\"success\\"}"}}]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as unknown as Response);

      const onChunk = vi.fn();

      // Act
      await adapter.streamComplete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
        onChunk,
      });

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toEqual(['```', '\n\n\n', 'Note:', 'I hope']);
      expect(callBody.stream).toBe(true);
    });

    it('should NOT add stop sequences for streaming creative output', async () => {
      // Arrange
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Once upon"}}]}\n\n'),
          })
          .mockResolvedValueOnce({ done: true, value: undefined }),
      };

      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      } as unknown as Response);

      const onChunk = vi.fn();

      // Act
      await adapter.streamComplete('Be creative', {
        userMessage: 'Write a story',
        onChunk,
        // No jsonMode
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.stop).toBeUndefined();
    });
  });

  // ============================================
  // Combined Optimizations Tests
  // ============================================

  describe('Combined Optimizations for Structured Output', () => {
    it('should apply ALL Llama 3 optimizations for structured output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON with specific schema', {
        userMessage: 'Test',
        jsonMode: true,
        schema: {
          name: 'test_response',
          schema: { type: 'object', properties: { result: { type: 'string' } } },
        },
      });

      // Assert - Verify ALL optimizations are applied together
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      
      // Temperature (Section 4.1)
      expect(callBody.temperature).toBe(0.1);
      
      // Top-P (Section 4.1)
      expect(callBody.top_p).toBe(0.95);

      // Stop sequences (Section 4.3 - NEW)
      expect(callBody.stop).toEqual(['```', '\n\n\n', 'Note:', 'I hope']);
      
      // Repetition penalties disabled (Section 4.2)
      expect(callBody.frequency_penalty).toBe(0);
      expect(callBody.presence_penalty).toBe(0);
      
      // Seed for reproducibility
      expect(callBody.seed).toBeDefined();
      expect(typeof callBody.seed).toBe('number');
      
      // Response format
      expect(callBody.response_format.type).toBe('json_schema');
    });

    it('should NOT apply structured output optimizations for creative generation', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Once upon a time...' } }],
          usage: { prompt_tokens: 10, completion_tokens: 20 },
        }),
      } as Response);

      // Act
      await adapter.complete('Write a creative story', {
        userMessage: 'Tell me a tale',
        // No jsonMode, no schema, no responseFormat
      });

      // Assert - Verify structured output optimizations are NOT applied
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      
      // Creative temperature
      expect(callBody.temperature).toBe(0.7);
      
      // Creative top_p
      expect(callBody.top_p).toBe(0.9);
      
      // NO stop sequences
      expect(callBody.stop).toBeUndefined();
      
      // NO repetition penalty settings
      expect(callBody.frequency_penalty).toBeUndefined();
      expect(callBody.presence_penalty).toBeUndefined();
      
      // NO response format
      expect(callBody.response_format).toBeUndefined();
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should throw APIError on HTTP error response', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      } as Response);

      // Act & Assert
      await expect(
        adapter.complete('Test', { userMessage: 'Hello', retryOnValidationFailure: false })
      ).rejects.toThrow(APIError);
    });

    it('should handle retryable errors (500)', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      } as Response);

      // Act & Assert
      try {
        await adapter.complete('Test', { 
          userMessage: 'Hello', 
          retryOnValidationFailure: false,
          maxRetries: 0, // No retries for faster test
        });
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        if (error instanceof APIError) {
          expect(error.statusCode).toBe(500);
          expect(error.isRetryable).toBe(true);
        }
      }
    });

    it('should handle rate limit errors (429)', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      } as Response);

      // Act & Assert
      try {
        await adapter.complete('Test', { 
          userMessage: 'Hello', 
          maxRetries: 0,
        });
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        if (error instanceof APIError) {
          expect(error.statusCode).toBe(429);
          expect(error.isRetryable).toBe(true);
        }
      }
    });
  });

  // ============================================
  // Health Check Tests
  // ============================================

  describe('healthCheck', () => {
    it('should return healthy when API responds successfully', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"status": "healthy"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      const result = await adapter.healthCheck();

      // Assert
      expect(result.healthy).toBe(true);
      expect(result.provider).toBe('groq');
    });

    it('should return unhealthy when API fails', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server Error',
      } as Response);

      // Act
      const result = await adapter.healthCheck();

      // Assert
      expect(result.healthy).toBe(false);
      expect(result.provider).toBe('groq');
      expect(result.error).toBeDefined();
    });
  });

  // ============================================
  // Seed Parameter Tests
  // ============================================

  describe('Seed Parameter', () => {
    it('should generate seed from system prompt for structured output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.seed).toBeDefined();
      expect(typeof callBody.seed).toBe('number');
      expect(callBody.seed).toBeGreaterThan(0);
      expect(callBody.seed).toBeLessThan(2147483647);
    });

    it('should use explicit seed when provided', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"result": "success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Return JSON', {
        userMessage: 'Test',
        jsonMode: true,
        seed: 12345,
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.seed).toBe(12345);
    });

    it('should NOT generate seed for creative output', async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Creative response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response);

      // Act
      await adapter.complete('Be creative', {
        userMessage: 'Write a story',
        // No seed, no jsonMode
      });

      // Assert
      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.seed).toBeUndefined();
    });
  });
});
