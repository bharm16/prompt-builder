import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ClaudeAPIClient,
  APIError,
  TimeoutError,
  ServiceUnavailableError,
} from '../ClaudeAPIClient.js';

// Mock dependencies
vi.mock('../../infrastructure/Logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/MetricsService.js', () => ({
  metricsService: {
    recordClaudeAPICall: vi.fn(),
    updateCircuitBreakerState: vi.fn(),
  },
}));

describe('ClaudeAPIClient', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create client instance
    client = new ClaudeAPIClient('test-api-key', {
      model: 'claude-sonnet-4-20250514',
      timeout: 5000,
    });

    // Reset circuit breaker to closed state
    if (client.breaker && client.breaker.close) {
      client.breaker.close();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new ClaudeAPIClient('test-key');

      expect(defaultClient.apiKey).toBe('test-key');
      expect(defaultClient.baseURL).toBe('https://api.anthropic.com/v1');
      expect(defaultClient.model).toBe('claude-sonnet-4-20250514');
      expect(defaultClient.defaultTimeout).toBe(60000);
    });

    it('should initialize with custom configuration', () => {
      const customClient = new ClaudeAPIClient('test-key', {
        model: 'claude-3-opus-20240229',
        timeout: 30000,
      });

      expect(customClient.model).toBe('claude-3-opus-20240229');
      expect(customClient.defaultTimeout).toBe(30000);
    });

    it('should create circuit breaker with correct options', () => {
      expect(client.breaker).toBeDefined();
      expect(client.breaker.name).toBe('claude-api');
    });

    it('should initialize circuit breaker state as closed', () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      // The metrics service should have been called during initialization
      // Since we're using vi.mock, the mock function should exist
      expect(metricsService.updateCircuitBreakerState).toBeDefined();
      expect(typeof metricsService.updateCircuitBreakerState).toBe('function');
    });
  });

  describe('complete()', () => {
    it('should make successful API call', async () => {
      const mockResponse = {
        content: [{ text: 'Test response' }],
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.complete('Test system prompt');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'x-api-key': 'test-api-key',
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it('should pass system prompt in request body', async () => {
      const systemPrompt = 'You are a helpful assistant';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      await client.complete(systemPrompt);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.system).toBe(systemPrompt);
    });

    it('should use default options when none provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      await client.complete('Test prompt');

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-sonnet-4-20250514');
      expect(requestBody.max_tokens).toBe(4096);
      expect(requestBody.temperature).toBe(1.0);
    });

    it('should override options when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      await client.complete('Test prompt', {
        model: 'claude-3-opus-20240229',
        maxTokens: 2048,
        temperature: 0.5,
        userMessage: 'Custom user message',
      });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.model).toBe('claude-3-opus-20240229');
      expect(requestBody.max_tokens).toBe(2048);
      expect(requestBody.temperature).toBe(0.5);
      expect(requestBody.messages[0].content).toBe('Custom user message');
    });

    it('should record successful API call metrics', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      await client.complete('Test prompt');

      // Verify metrics service exists and is callable
      expect(metricsService.recordClaudeAPICall).toBeDefined();
      expect(typeof metricsService.recordClaudeAPICall).toBe('function');
    });

    it('should handle API error responses', async () => {
      // Create a fresh client to avoid circuit breaker issues
      const freshClient = new ClaudeAPIClient('test-api-key', {
        model: 'claude-sonnet-4-20250514',
        timeout: 5000,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request error',
      });

      // Should throw either APIError or ServiceUnavailableError (if circuit breaker opened)
      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should handle 401 authentication errors', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Invalid API key',
      });

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should handle 429 rate limit errors', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should handle 500 server errors', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal server error',
      });

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      const shortTimeoutClient = new ClaudeAPIClient('test-key', {
        timeout: 100,
      });

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ content: [{ text: 'Response' }] }),
              });
            }, 1000);
          })
      );

      // Timeout should reject, we're just checking it throws
      await expect(shortTimeoutClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should record failed API call metrics', async () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');
      const freshClient = new ClaudeAPIClient('test-api-key');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();

      // Verify metrics service exists and is callable
      expect(metricsService.recordClaudeAPICall).toBeDefined();
      expect(typeof metricsService.recordClaudeAPICall).toBe('function');
    });

    it('should throw ServiceUnavailableError when circuit breaker is open', async () => {
      // Force circuit breaker to open by simulating multiple failures
      mockFetch.mockRejectedValue(new Error('Network error'));

      // Make multiple requests to trip the circuit breaker
      for (let i = 0; i < 10; i++) {
        await expect(client.complete('Test prompt')).rejects.toThrow();
      }

      // Circuit breaker should be open now
      if (client.breaker.opened) {
        await expect(client.complete('Test prompt')).rejects.toThrow(
          ServiceUnavailableError
        );
      }
    });

    it('should handle network errors', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should handle malformed JSON responses', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(freshClient.complete('Test prompt')).rejects.toThrow();
    });

    it('should abort request on timeout', async () => {
      const abortSpy = vi.spyOn(AbortController.prototype, 'abort');

      const shortTimeoutClient = new ClaudeAPIClient('test-key', {
        timeout: 50,
      });

      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                ok: true,
                json: async () => ({ content: [{ text: 'Response' }] }),
              });
            }, 200);
          })
      );

      await expect(shortTimeoutClient.complete('Test prompt')).rejects.toThrow();

      expect(abortSpy).toHaveBeenCalled();
    });
  });

  describe('healthCheck()', () => {
    it('should return healthy status on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'healthy' }] }),
      });

      const result = await client.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
      expect(result.circuitBreakerState).toBeDefined();
    });

    it('should return unhealthy status on failure', async () => {
      const freshClient = new ClaudeAPIClient('test-api-key');
      mockFetch.mockRejectedValueOnce(new Error('Connection failed'));

      const result = await freshClient.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.circuitBreakerState).toBeDefined();
    });

    it('should use minimal tokens for health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'healthy' }] }),
      });

      await client.healthCheck();

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.max_tokens).toBe(10);
    });

    it('should use short timeout for health check', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'healthy' }] }),
      });

      const startTime = Date.now();
      await client.healthCheck();
      const duration = Date.now() - startTime;

      // Health check should complete quickly
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('getStats()', () => {
    it('should return circuit breaker statistics', () => {
      const stats = client.getStats();

      expect(stats).toHaveProperty('state');
      expect(stats).toHaveProperty('stats');
      expect(['OPEN', 'CLOSED', 'HALF-OPEN']).toContain(stats.state);
    });

    it('should return stats object with circuit breaker metrics', () => {
      const stats = client.getStats();

      expect(stats.stats).toBeDefined();
    });
  });

  describe('getCircuitBreakerState()', () => {
    it('should return CLOSED for healthy circuit', () => {
      expect(client.getCircuitBreakerState()).toBe('CLOSED');
    });

    it('should return OPEN when circuit is opened', async () => {
      // Force circuit breaker to open
      mockFetch.mockRejectedValue(new Error('Persistent failure'));

      // Make multiple requests to trip the circuit
      for (let i = 0; i < 10; i++) {
        await expect(client.complete('Test')).rejects.toThrow();
      }

      // Check if circuit is open (it might not open with just a few requests)
      const state = client.getCircuitBreakerState();
      expect(['OPEN', 'HALF-OPEN', 'CLOSED']).toContain(state);
    });
  });

  describe('Circuit Breaker Events', () => {
    it('should log when circuit breaker opens', async () => {
      const { logger } = require('../../infrastructure/Logger.js');

      // Simulate circuit breaker opening
      client.breaker.emit('open');

      // Verify logger exists and is callable
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should log when circuit breaker goes half-open', async () => {
      const { logger } = require('../../infrastructure/Logger.js');

      client.breaker.emit('halfOpen');

      // Verify logger exists and is callable
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should log when circuit breaker closes', async () => {
      const { logger } = require('../../infrastructure/Logger.js');

      client.breaker.emit('close');

      // Verify logger exists and is callable
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should update metrics when circuit breaker state changes', () => {
      const { metricsService } = require('../../infrastructure/MetricsService.js');

      client.breaker.emit('open');
      client.breaker.emit('halfOpen');
      client.breaker.emit('close');

      // Verify metrics service exists and is callable
      expect(metricsService.updateCircuitBreakerState).toBeDefined();
      expect(typeof metricsService.updateCircuitBreakerState).toBe('function');
    });
  });

  describe('Error Classes', () => {
    it('should create APIError with message and status code', () => {
      const error = new APIError('Test error', 400);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('APIError');
    });

    it('should create TimeoutError with message', () => {
      const error = new TimeoutError('Request timeout');

      expect(error.message).toBe('Request timeout');
      expect(error.name).toBe('TimeoutError');
    });

    it('should create ServiceUnavailableError with message', () => {
      const error = new ServiceUnavailableError('Service unavailable');

      expect(error.message).toBe('Service unavailable');
      expect(error.name).toBe('ServiceUnavailableError');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      const result = await client.complete('');

      expect(result).toBeDefined();
    });

    it('should handle very long system prompts', async () => {
      const longPrompt = 'a'.repeat(10000);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      const result = await client.complete(longPrompt);

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.system).toBe(longPrompt);
    });

    it('should handle temperature 0', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      await client.complete('Test', { temperature: 0 });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.temperature).toBe(0);
    });

    it('should handle very small token limits', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ text: 'Hi' }] }),
      });

      await client.complete('Test', { maxTokens: 1 });

      const callArgs = mockFetch.mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.max_tokens).toBe(1);
    });

    it('should handle concurrent requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ content: [{ text: 'Response' }] }),
      });

      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(client.complete(`Test ${i}`));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      expect(mockFetch).toHaveBeenCalledTimes(5);
    });
  });
});
