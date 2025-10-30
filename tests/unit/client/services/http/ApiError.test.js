import { describe, it, expect } from 'vitest';
import { ApiError } from '../../../../../client/src/services/http/ApiError.js';
import { ApiErrorFactory } from '../../../../../client/src/services/http/ApiErrorFactory.js';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with message, status, and response', () => {
      const error = new ApiError('Test error', 500, { data: 'response' });

      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.response).toEqual({ data: 'response' });
    });

    it('should set name to ApiError', () => {
      const error = new ApiError('Test', 500);

      expect(error.name).toBe('ApiError');
    });

    it('should extend Error class', () => {
      const error = new ApiError('Test', 500);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
    });

    it('should have stack trace', () => {
      const error = new ApiError('Test', 500);

      expect(error.stack).toBeDefined();
    });
  });

  describe('isNetworkError', () => {
    it('should return true when status is falsy', () => {
      const error1 = new ApiError('Network error', null);
      const error2 = new ApiError('Network error', undefined);
      const error3 = new ApiError('Network error', 0);

      expect(error1.isNetworkError()).toBe(true);
      expect(error2.isNetworkError()).toBe(true);
      expect(error3.isNetworkError()).toBe(true);
    });

    it('should return false when status exists', () => {
      const error = new ApiError('Server error', 500);

      expect(error.isNetworkError()).toBe(false);
    });

    it('should return false for any HTTP status code', () => {
      const statuses = [200, 400, 401, 404, 500, 503];

      statuses.forEach(status => {
        const error = new ApiError('Error', status);
        expect(error.isNetworkError()).toBe(false);
      });
    });
  });

  describe('isClientError', () => {
    it('should return true for 4xx status codes', () => {
      const error400 = new ApiError('Bad Request', 400);
      const error404 = new ApiError('Not Found', 404);
      const error499 = new ApiError('Custom', 499);

      expect(error400.isClientError()).toBe(true);
      expect(error404.isClientError()).toBe(true);
      expect(error499.isClientError()).toBe(true);
    });

    it('should return false for non-4xx status codes', () => {
      const error200 = new ApiError('OK', 200);
      const error500 = new ApiError('Server Error', 500);
      const error399 = new ApiError('Custom', 399);

      expect(error200.isClientError()).toBe(false);
      expect(error500.isClientError()).toBe(false);
      expect(error399.isClientError()).toBe(false);
    });

    it('should return false for network errors', () => {
      const error = new ApiError('Network', null);

      expect(error.isClientError()).toBe(false);
    });
  });

  describe('isServerError', () => {
    it('should return true for 5xx status codes', () => {
      const error500 = new ApiError('Internal Server Error', 500);
      const error503 = new ApiError('Service Unavailable', 503);
      const error599 = new ApiError('Custom', 599);

      expect(error500.isServerError()).toBe(true);
      expect(error503.isServerError()).toBe(true);
      expect(error599.isServerError()).toBe(true);
    });

    it('should return false for non-5xx status codes', () => {
      const error200 = new ApiError('OK', 200);
      const error400 = new ApiError('Bad Request', 400);
      const error499 = new ApiError('Custom', 499);

      expect(error200.isServerError()).toBe(false);
      expect(error400.isServerError()).toBe(false);
      expect(error499.isServerError()).toBe(false);
    });

    it('should return true for codes >= 500 (including non-standard 6xx)', () => {
      const error600 = new ApiError('Custom', 600);
      // Implementation uses >=  500, so 600 returns true
      expect(error600.isServerError()).toBe(true);
    });

    it('should return false for network errors', () => {
      const error = new ApiError('Network', null);

      expect(error.isServerError()).toBe(false);
    });
  });

  describe('isUnauthorized', () => {
    it('should return true for 401 status', () => {
      const error = new ApiError('Unauthorized', 401);

      expect(error.isUnauthorized()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error400 = new ApiError('Bad Request', 400);
      const error403 = new ApiError('Forbidden', 403);
      const error500 = new ApiError('Server Error', 500);

      expect(error400.isUnauthorized()).toBe(false);
      expect(error403.isUnauthorized()).toBe(false);
      expect(error500.isUnauthorized()).toBe(false);
    });
  });

  describe('isNotFound', () => {
    it('should return true for 404 status', () => {
      const error = new ApiError('Not Found', 404);

      expect(error.isNotFound()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error400 = new ApiError('Bad Request', 400);
      const error403 = new ApiError('Forbidden', 403);
      const error500 = new ApiError('Server Error', 500);

      expect(error400.isNotFound()).toBe(false);
      expect(error403.isNotFound()).toBe(false);
      expect(error500.isNotFound()).toBe(false);
    });
  });

  describe('isRateLimited', () => {
    it('should return true for 429 status', () => {
      const error = new ApiError('Too Many Requests', 429);

      expect(error.isRateLimited()).toBe(true);
    });

    it('should return false for other status codes', () => {
      const error400 = new ApiError('Bad Request', 400);
      const error500 = new ApiError('Server Error', 500);

      expect(error400.isRateLimited()).toBe(false);
      expect(error500.isRateLimited()).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle missing response parameter', () => {
      const error = new ApiError('Test', 500);

      expect(error.response).toBeUndefined();
    });

    it('should handle complex response objects', () => {
      const complexResponse = {
        data: { nested: { value: 'test' } },
        headers: { 'content-type': 'application/json' },
        config: { url: '/api/test' }
      };

      const error = new ApiError('Test', 500, complexResponse);

      expect(error.response).toEqual(complexResponse);
    });

    it('should be catchable as Error', () => {
      try {
        throw new ApiError('Test', 500);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e.message).toBe('Test');
      }
    });

    it('should work with instanceof checks', () => {
      const error = new ApiError('Test', 500);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
    });

    it('should handle status 0', () => {
      const error = new ApiError('Network error', 0);

      expect(error.status).toBe(0);
      expect(error.isNetworkError()).toBe(true);
      expect(error.isClientError()).toBe(false);
      expect(error.isServerError()).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should correctly identify different error types', () => {
      const errors = [
        { error: new ApiError('Network', null), checks: { network: true, client: false, server: false } },
        { error: new ApiError('Bad Request', 400), checks: { network: false, client: true, server: false } },
        { error: new ApiError('Server Error', 500), checks: { network: false, client: false, server: true } },
        { error: new ApiError('Not Found', 404), checks: { network: false, client: true, server: false, notFound: true } },
        { error: new ApiError('Unauthorized', 401), checks: { network: false, client: true, server: false, unauthorized: true } },
        { error: new ApiError('Rate Limited', 429), checks: { network: false, client: true, server: false, rateLimited: true } },
      ];

      errors.forEach(({ error, checks }) => {
        expect(error.isNetworkError()).toBe(checks.network);
        expect(error.isClientError()).toBe(checks.client);
        expect(error.isServerError()).toBe(checks.server);

        if ('notFound' in checks) expect(error.isNotFound()).toBe(checks.notFound);
        if ('unauthorized' in checks) expect(error.isUnauthorized()).toBe(checks.unauthorized);
        if ('rateLimited' in checks) expect(error.isRateLimited()).toBe(checks.rateLimited);
      });
    });
  });
});

describe('ApiErrorFactory', () => {
  let factory;

  beforeEach(() => {
    factory = new ApiErrorFactory();
  });

  describe('create', () => {
    it('should create ApiError with provided parameters', () => {
      const error = factory.create({
        message: 'Test error',
        status: 500,
        response: { data: 'test' }
      });

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Test error');
      expect(error.status).toBe(500);
      expect(error.response).toEqual({ data: 'test' });
    });

    it('should use default status of null when not provided', () => {
      const error = factory.create({ message: 'Network error' });

      expect(error.status).toBeNull();
    });

    it('should use default response of null when not provided', () => {
      const error = factory.create({ message: 'Test', status: 500 });

      expect(error.response).toBeNull();
    });

    it('should handle all parameters as undefined', () => {
      const error = factory.create({});

      expect(error).toBeInstanceOf(ApiError);
    });
  });

  describe('createTimeout', () => {
    it('should create network error with timeout message', () => {
      const error = factory.createTimeout();

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Request timeout');
      expect(error.isNetworkError()).toBe(true);
    });

    it('should accept custom timeout message', () => {
      const error = factory.createTimeout('Custom timeout');

      expect(error.message).toBe('Custom timeout');
    });

    it('should create network error (no status)', () => {
      const error = factory.createTimeout();

      expect(error.status).toBeNull();
    });
  });

  describe('createNetwork', () => {
    it('should create network error with default message', () => {
      const error = factory.createNetwork({});

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Network error');
      expect(error.isNetworkError()).toBe(true);
    });

    it('should extract message from error object', () => {
      const originalError = new Error('Connection failed');
      const error = factory.createNetwork(originalError);

      expect(error.message).toBe('Connection failed');
    });

    it('should handle error without message property', () => {
      const error = factory.createNetwork({ code: 'ECONNREFUSED' });

      expect(error.message).toBe('Network error');
    });

    it('should handle null error', () => {
      const error = factory.createNetwork(null);

      expect(error.message).toBe('Network error');
    });

    it('should handle undefined error', () => {
      const error = factory.createNetwork(undefined);

      expect(error.message).toBe('Network error');
    });

    it('should create network error (no status)', () => {
      const error = factory.createNetwork({});

      expect(error.status).toBeNull();
    });
  });

  describe('integration scenarios', () => {
    it('should handle timeout scenario', () => {
      const error = factory.createTimeout('Request took too long');

      expect(error.isNetworkError()).toBe(true);
      expect(error.isClientError()).toBe(false);
      expect(error.isServerError()).toBe(false);
    });

    it('should handle network failure scenario', () => {
      const originalError = new Error('Failed to fetch');
      const error = factory.createNetwork(originalError);

      expect(error.message).toContain('Failed to fetch');
      expect(error.isNetworkError()).toBe(true);
    });

    it('should create different error types', () => {
      const timeout = factory.createTimeout();
      const network = factory.createNetwork(new Error('Connection lost'));
      const custom = factory.create({ message: 'Custom', status: 418 });

      expect(timeout.message).toBe('Request timeout');
      expect(network.message).toBe('Connection lost');
      expect(custom.status).toBe(418);
    });
  });

  describe('edge cases', () => {
    it('should handle error object with nested message', () => {
      const complexError = {
        response: { data: { message: 'Nested message' } },
        message: 'Top message'
      };

      const error = factory.createNetwork(complexError);

      expect(error.message).toBe('Top message');
    });

    it('should handle empty string message', () => {
      const error = factory.createNetwork({ message: '' });

      expect(error.message).toBe('Network error'); // Should use default
    });

    it('should create multiple errors independently', () => {
      const error1 = factory.create({ message: 'Error 1', status: 400 });
      const error2 = factory.create({ message: 'Error 2', status: 500 });

      expect(error1.message).toBe('Error 1');
      expect(error2.message).toBe('Error 2');
      expect(error1.status).not.toBe(error2.status);
    });
  });
});
