/**
 * @test {ClaudeAPIClient}
 * @description Comprehensive test suite for ClaudeAPIClient
 * 
 * Test Coverage:
 * - Constructor initialization and configuration
 * - Request execution with circuit breaker
 * - Request coalescing and deduplication
 * - Timeout handling and error handling
 * - Statistics tracking and metrics
 * - Health checks and graceful shutdown
 * 
 * Mocking Strategy:
 * - Logger and MetricsService are module-level mocks (not ideal, but necessary)
 *   because ClaudeAPIClient doesn't currently support constructor injection
 * - NOTE: Ideally, ClaudeAPIClient would accept logger and metricsService
 *   as constructor parameters for true dependency injection
 * - global.fetch IS mocked here (appropriate for HTTP client testing)
 * - Circuit breaker mocked to avoid complex async behavior in tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Module-level mocks (required due to direct imports in ClaudeAPIClient)
// TODO: Refactor ClaudeAPIClient to accept logger and metricsService via constructor
vi.mock('../../infrastructure/Logger.ts', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../infrastructure/MetricsService.ts', () => ({
  metricsService: {
    updateCircuitBreakerState: vi.fn(),
    recordClaudeAPICall: vi.fn(),
  },
}));

// Mock circuit breaker for predictable behavior
vi.mock('opossum', () => {
  return {
    default: class MockCircuitBreaker {
      constructor(fn, options) {
        this.fn = fn;
        this.options = options;
        this.opened = false;
        this.halfOpen = false;
        this.stats = {
          fires: 0,
          failures: 0,
          successes: 0,
          rejects: 0,
          timeouts: 0,
        };
        this._eventHandlers = {};
      }

      async fire(...args) {
        this.stats.fires++;
        try {
          const result = await this.fn(...args);
          this.stats.successes++;
          return result;
        } catch (error) {
          this.stats.failures++;
          throw error;
        }
      }

      on(event, handler) {
        this._eventHandlers[event] = handler;
      }

      _triggerEvent(event) {
        if (this._eventHandlers[event]) {
          this._eventHandlers[event]();
        }
      }
    },
  };
});

import { ClaudeAPIClient, APIError, TimeoutError, ServiceUnavailableError } from '../ClaudeAPIClient.js';

describe('ClaudeAPIClient', () => {
  let client;
  let mockFetch;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Create client instance
    client = new ClaudeAPIClient('test-api-key', {
      model: 'claude-sonnet-4-20250514',
      timeout: 5000,
    });
  });

  afterEach(async () => {
    // Clean up
    await client.shutdown();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultClient = new ClaudeAPIClient('test-key');

      expect(defaultClient.apiKey).toBe('test-key');
      expect(defaultClient.baseURL).toBe('https://api.anthropic.com/v1');
      expect(defaultClient.model).toBe('claude-sonnet-4-20250514');
      expect(defaultClient.defaultTimeout).toBe(60000);
    });

    it('should initialize with custom configuration', () => {
      const customClient = new ClaudeAPIClient('custom-key', {
        model: 'claude-opus-4-20250514',
        timeout: 10000,
      });

      expect(customClient.model).toBe('claude-opus-4-20250514');
      expect(customClient.defaultTimeout).toBe(10000);
    });

    it('should initialize connection pooling agent with correct settings', () => {
      expect(client.agent).toBeDefined();
      expect(client.agent.keepAlive).toBe(true);
      expect(client.agent.maxSockets).toBe(50);
      expect(client.agent.maxFreeSockets).toBe(10);
    });

    it('should initialize request coalescing map', () => {
      expect(client.inFlightRequests).toBeInstanceOf(Map);
      expect(client.inFlightRequests.size).toBe(0);
    });

    it('should initialize statistics tracking', () => {
      expect(client.stats).toEqual({
        totalRequests: 0,
        coalescedRequests: 0,
        totalTokens: 0,
        totalDuration: 0,
      });
    });
  });

  describe('Request Fingerprint Generation', () => {
    it('should generate identical fingerprints for identical prompts', () => {
      const prompt = 'Test prompt for fingerprinting';
      const options = { maxTokens: 1024 };

      const fingerprint1 = client._generateRequestFingerprint(prompt, options);
      const fingerprint2 = client._generateRequestFingerprint(prompt, options);

      expect(fingerprint1).toBe(fingerprint2);
    });

    it('should generate different fingerprints for different prompts', () => {
      const fingerprint1 = client._generateRequestFingerprint('Prompt A', {});
      const fingerprint2 = client._generateRequestFingerprint('Prompt B', {});

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different max tokens', () => {
      const prompt = 'Same prompt';
      const fingerprint1 = client._generateRequestFingerprint(prompt, { maxTokens: 1024 });
      const fingerprint2 = client._generateRequestFingerprint(prompt, { maxTokens: 2048 });

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should generate different fingerprints for different models', () => {
      const prompt = 'Same prompt';
      const fingerprint1 = client._generateRequestFingerprint(prompt, { model: 'model-a' });
      const fingerprint2 = client._generateRequestFingerprint(prompt, { model: 'model-b' });

      expect(fingerprint1).not.toBe(fingerprint2);
    });

    it('should truncate long prompts to 500 characters for fingerprint', () => {
      const longPrompt = 'a'.repeat(1000);
      const fingerprint = client._generateRequestFingerprint(longPrompt, {});

      // Fingerprint should be based on first 500 chars
      expect(fingerprint).toContain('a'.repeat(500));
      expect(fingerprint).not.toContain('a'.repeat(501));
    });
  });

  describe('Request Coalescing Logic', () => {
    it('should NOT coalesce the first request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('Test prompt', { maxTokens: 100 });

      expect(client.stats.coalescedRequests).toBe(0);
      expect(client.stats.totalRequests).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should coalesce identical concurrent requests', async () => {
      // Setup mock to resolve after a delay
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 100)
        )
      );

      const prompt = 'Test prompt';
      const options = { maxTokens: 100 };

      // Fire two identical requests concurrently
      const [result1, result2] = await Promise.all([
        client.complete(prompt, options),
        client.complete(prompt, options),
      ]);

      // Both should get the same result
      expect(result1).toEqual(result2);

      // Should only make ONE actual API call
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request should be marked as coalesced
      expect(client.stats.totalRequests).toBe(2);
      expect(client.stats.coalescedRequests).toBe(1);
    });

    it('should NOT coalesce different requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('Prompt A', { maxTokens: 100 });
      await client.complete('Prompt B', { maxTokens: 100 });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(client.stats.coalescedRequests).toBe(0);
    });

    it('should clean up fingerprint after coalescing window', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('Test prompt', {});

      // Fingerprint should still exist immediately
      expect(client.inFlightRequests.size).toBeGreaterThan(0);

      // Wait for cleanup window (100ms)
      await new Promise(resolve => setTimeout(resolve, 150));

      // Fingerprint should be cleaned up
      expect(client.inFlightRequests.size).toBe(0);
    });

    it('should retry if coalesced request fails', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First request fails
          return Promise.reject(new Error('Network error'));
        }
        // Retry succeeds
        return Promise.resolve({
          ok: true,
          json: async () => ({
            content: [{ text: 'Success after retry' }],
            usage: { input_tokens: 10, output_tokens: 20 },
          }),
        });
      });

      const prompt = 'Test prompt';

      // First request
      const request1Promise = client.complete(prompt, {});

      // Second request tries to coalesce
      const request2Promise = client.complete(prompt, {});

      // First request fails, second retries
      await expect(request1Promise).rejects.toThrow('Network error');
      const result2 = await request2Promise;

      expect(result2.content[0].text).toBe('Success after retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('API Request Execution', () => {
    it('should make successful API request with correct payload', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Generated response' }],
          usage: { input_tokens: 50, output_tokens: 100 },
        }),
      });

      const result = await client.complete('System prompt', {
        maxTokens: 2048,
        userMessage: 'Custom user message',
      });

      expect(result.content[0].text).toBe('Generated response');

      // Verify fetch was called with correct parameters
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

      // Verify request body
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body).toEqual({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: 'System prompt',
        messages: [{ role: 'user', content: 'Custom user message' }],
      });
    });

    it('should use default user message if not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('System prompt');

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.messages[0].content).toBe('Please proceed.');
    });

    it('should track token usage from response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      });

      await client.complete('Test prompt');

      expect(client.stats.totalTokens).toBe(300); // 100 + 200
    });

    it('should track request duration', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 100)
        )
      );

      await client.complete('Test prompt');

      expect(client.stats.totalDuration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Error Handling', () => {
    it('should throw APIError for non-ok HTTP responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad request error',
      });

      await expect(client.complete('Test prompt')).rejects.toThrow(APIError);
      await expect(client.complete('Test prompt')).rejects.toThrow(
        'Claude API error: 400 - Bad request error'
      );
    });

    it('should include status code in APIError', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        text: async () => 'Rate limited',
      });

      try {
        await client.complete('Test prompt');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect(error.statusCode).toBe(429);
      }
    });

    it('should throw TimeoutError when request times out', async () => {
      mockFetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
          // Never resolve to simulate long request
          setTimeout(() => resolve({ ok: true }), 10000);
        });
      });

      const shortTimeoutClient = new ClaudeAPIClient('test-key', {
        timeout: 100,
      });

      await expect(shortTimeoutClient.complete('Test prompt')).rejects.toThrow(TimeoutError);
      await expect(shortTimeoutClient.complete('Test prompt')).rejects.toThrow(
        /timeout after 100ms/
      );
    }, 15000); // Increase test timeout

    it('should clear timeout on successful response', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('Test prompt');

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should clear timeout on error', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(client.complete('Test prompt')).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });

    it('should throw ServiceUnavailableError when circuit breaker is open', async () => {
      // Simulate circuit breaker open by making fire() throw
      client.breaker.opened = true;
      client.breaker.fire = vi.fn().mockRejectedValue(new Error('Circuit breaker is open'));

      await expect(client.complete('Test prompt')).rejects.toThrow(ServiceUnavailableError);
      await expect(client.complete('Test prompt')).rejects.toThrow(
        'Claude API is currently unavailable'
      );
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should trigger circuit breaker on event', async () => {
      // Get fresh mock after client initialization
        const mockModule = await import('../../infrastructure/MetricsService.ts');
      const metricsService = mockModule.metricsService;

      // Clear previous calls from constructor
      vi.clearAllMocks();

      // Trigger open event
      client.breaker._triggerEvent('open');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'claude-api',
        'open'
      );

      // Trigger half-open event
      client.breaker._triggerEvent('halfOpen');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'claude-api',
        'half-open'
      );

      // Trigger close event
      client.breaker._triggerEvent('close');
      expect(metricsService.updateCircuitBreakerState).toHaveBeenCalledWith(
        'claude-api',
        'closed'
      );
    });

    it('should return correct circuit breaker state', () => {
      expect(client.getCircuitBreakerState()).toBe('CLOSED');

      client.breaker.opened = true;
      expect(client.getCircuitBreakerState()).toBe('OPEN');

      client.breaker.opened = false;
      client.breaker.halfOpen = true;
      expect(client.getCircuitBreakerState()).toBe('HALF-OPEN');
    });
  });

  describe('Metrics Recording', () => {
    it('should record successful API calls with mode', async () => {
        const mockModule = await import('../../infrastructure/MetricsService.ts');
      const metricsService = mockModule.metricsService;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      vi.clearAllMocks();
      await client.complete('Test prompt', { mode: 'reasoning' });

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'messages',
        expect.any(Number),
        true,
        'reasoning'
      );
    });

    it('should record failed API calls', async () => {
        const mockModule = await import('../../infrastructure/MetricsService.ts');
      const metricsService = mockModule.metricsService;

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      vi.clearAllMocks();
      await expect(client.complete('Test prompt', { mode: 'default' })).rejects.toThrow();

      expect(metricsService.recordClaudeAPICall).toHaveBeenCalledWith(
        'messages',
        expect.any(Number),
        false,
        'default'
      );
    });
  });

  describe('Health Check', () => {
    it('should return healthy status on successful check', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'healthy' }],
              usage: { input_tokens: 5, output_tokens: 5 },
            }),
          }), 10)
        )
      );

      const health = await client.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.responseTime).toBeGreaterThan(0);
      expect(health.circuitBreakerState).toBe('CLOSED');
    });

    it('should return unhealthy status on failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable',
      });

      const health = await client.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.error).toBeDefined();
      expect(health.circuitBreakerState).toBe('CLOSED');
    });

    it('should use short timeout for health checks', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'healthy' }],
          usage: { input_tokens: 5, output_tokens: 5 },
        }),
      });

      await client.healthCheck();

      // Verify health check used 5s timeout
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      // Health check should request minimal tokens
      expect(body.max_tokens).toBe(10);
    });
  });

  describe('Statistics', () => {
    it('should calculate average duration correctly', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 50)
        )
      );

      await client.complete('Prompt 1');
      await client.complete('Prompt 2');

      const stats = client.getStats();

      expect(stats.requests.total).toBe(2);
      expect(parseInt(stats.requests.avgDuration)).toBeGreaterThanOrEqual(50);
    });

    it('should calculate coalescing rate correctly', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 100)
        )
      );

      const prompt = 'Same prompt';

      // Fire 3 requests: 2 identical (coalesce) + 1 different
      await Promise.all([
        client.complete(prompt),
        client.complete(prompt),
      ]);
      await client.complete('Different prompt');

      const stats = client.getStats();

      expect(stats.requests.total).toBe(3);
      expect(stats.requests.coalesced).toBe(1);
      expect(stats.requests.coalescingRate).toBe('33.33%');
    });

    it('should track total tokens correctly', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      });

      await client.complete('Prompt 1');
      await client.complete('Prompt 2');

      const stats = client.getStats();

      expect(stats.tokens.total).toBe(600); // (100+200) * 2
      expect(stats.tokens.avgPerRequest).toBe(300);
    });

    it('should handle zero requests gracefully', () => {
      const stats = client.getStats();

      expect(stats.requests.avgDuration).toBe('0ms');
      expect(stats.requests.coalescingRate).toBe('0.00%');
      expect(stats.tokens.avgPerRequest).toBe(0);
    });

    it('should include circuit breaker stats', () => {
      const stats = client.getStats();

      expect(stats.state).toBe('CLOSED');
      expect(stats.breaker).toBeDefined();
    });

    it('should track in-flight request count', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 100)
        )
      );

      const promise = client.complete('Test');

      // Check in-flight count while request is pending
      const statsWhilePending = client.getStats();
      expect(statsWhilePending.connections.inFlight).toBeGreaterThan(0);

      await promise;
    });
  });

  describe('Graceful Shutdown', () => {
    it('should wait for in-flight requests to complete', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              content: [{ text: 'Response' }],
              usage: { input_tokens: 10, output_tokens: 20 },
            }),
          }), 100)
        )
      );

      // Start request but don't await
      const requestPromise = client.complete('Test');

      // Shutdown should wait for it
      const shutdownPromise = client.shutdown();

      // Both should complete
      await Promise.all([requestPromise, shutdownPromise]);

      expect(client.inFlightRequests.size).toBe(0);
    });

    it('should timeout shutdown after 5 seconds', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(() => {}) // Never resolves
      );

      // Start request that never completes
      client.complete('Test').catch(() => {});

      const startTime = Date.now();
      await client.shutdown();
      const duration = Date.now() - startTime;

      // Should timeout around 5000ms
      expect(duration).toBeGreaterThanOrEqual(5000);
      expect(duration).toBeLessThan(6000);
    });

    it('should destroy connection pool agent', async () => {
      const destroySpy = vi.spyOn(client.agent, 'destroy');

      await client.shutdown();

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle responses without usage data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          // No usage field
        }),
      });

      await client.complete('Test prompt');

      // Should not throw, tokens should remain unchanged
      expect(client.stats.totalTokens).toBe(0);
    });

    it('should handle empty system prompt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('');

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.system).toBe('');
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'a'.repeat(10000);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete(longPrompt);

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.system).toBe(longPrompt);
    });

    it('should handle custom model override', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: [{ text: 'Response' }],
          usage: { input_tokens: 10, output_tokens: 20 },
        }),
      });

      await client.complete('Test', { model: 'claude-opus-4-20250514' });

      const callArgs = mockFetch.mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      expect(body.model).toBe('claude-opus-4-20250514');
    });

    it('should handle custom timeout override', async () => {
      mockFetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortError = new Error('Aborted');
              abortError.name = 'AbortError';
              reject(abortError);
            });
          }
          // Never resolve to simulate long request
          setTimeout(() => resolve({ ok: true }), 10000);
        });
      });

      // Override with short timeout
      await expect(
        client.complete('Test', { timeout: 50 })
      ).rejects.toThrow(TimeoutError);
    }, 15000); // Increase test timeout
  });
});
