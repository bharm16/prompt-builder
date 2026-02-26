/**
 * Unit tests for ApiError
 *
 * Tests error classification methods across all HTTP status categories.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '../ApiError';

describe('ApiError', () => {
  // --- Constructor ---
  it('sets name to ApiError', () => {
    const error = new ApiError('test');
    expect(error.name).toBe('ApiError');
  });

  it('stores message, status, and response', () => {
    const error = new ApiError('Not Found', 404, { detail: 'missing' });
    expect(error.message).toBe('Not Found');
    expect(error.status).toBe(404);
    expect(error.response).toEqual({ detail: 'missing' });
  });

  it('is an instance of Error', () => {
    expect(new ApiError('test')).toBeInstanceOf(Error);
  });

  it('has undefined status and response by default', () => {
    const error = new ApiError('test');
    expect(error.status).toBeUndefined();
    expect(error.response).toBeUndefined();
  });

  // --- isNetworkError ---
  describe('isNetworkError', () => {
    it('returns true when status is undefined', () => {
      expect(new ApiError('network fail').isNetworkError()).toBe(true);
    });

    it('returns false when status is defined', () => {
      expect(new ApiError('bad', 500).isNetworkError()).toBe(false);
    });

    it('returns false when status is 0', () => {
      expect(new ApiError('bad', 0).isNetworkError()).toBe(false);
    });
  });

  // --- isClientError ---
  describe('isClientError', () => {
    it('returns true for 400', () => {
      expect(new ApiError('bad', 400).isClientError()).toBe(true);
    });

    it('returns true for 499', () => {
      expect(new ApiError('bad', 499).isClientError()).toBe(true);
    });

    it('returns true for 401', () => {
      expect(new ApiError('unauth', 401).isClientError()).toBe(true);
    });

    it('returns true for 404', () => {
      expect(new ApiError('not found', 404).isClientError()).toBe(true);
    });

    it('returns true for 429', () => {
      expect(new ApiError('rate limited', 429).isClientError()).toBe(true);
    });

    it('returns false for 500', () => {
      expect(new ApiError('bad', 500).isClientError()).toBe(false);
    });

    it('returns false for 399', () => {
      expect(new ApiError('bad', 399).isClientError()).toBe(false);
    });

    it('returns false when status is undefined', () => {
      expect(new ApiError('bad').isClientError()).toBe(false);
    });
  });

  // --- isServerError ---
  describe('isServerError', () => {
    it('returns true for 500', () => {
      expect(new ApiError('fail', 500).isServerError()).toBe(true);
    });

    it('returns true for 503', () => {
      expect(new ApiError('fail', 503).isServerError()).toBe(true);
    });

    it('returns true for 502', () => {
      expect(new ApiError('fail', 502).isServerError()).toBe(true);
    });

    it('returns false for 400', () => {
      expect(new ApiError('fail', 400).isServerError()).toBe(false);
    });

    it('returns false for 499', () => {
      expect(new ApiError('fail', 499).isServerError()).toBe(false);
    });

    it('returns false when status is undefined', () => {
      expect(new ApiError('fail').isServerError()).toBe(false);
    });
  });

  // --- isUnauthorized ---
  describe('isUnauthorized', () => {
    it('returns true for 401', () => {
      expect(new ApiError('unauth', 401).isUnauthorized()).toBe(true);
    });

    it('returns false for 403', () => {
      expect(new ApiError('forbidden', 403).isUnauthorized()).toBe(false);
    });

    it('returns false when status is undefined', () => {
      expect(new ApiError('unauth').isUnauthorized()).toBe(false);
    });
  });

  // --- isNotFound ---
  describe('isNotFound', () => {
    it('returns true for 404', () => {
      expect(new ApiError('nope', 404).isNotFound()).toBe(true);
    });

    it('returns false for 400', () => {
      expect(new ApiError('nope', 400).isNotFound()).toBe(false);
    });

    it('returns false when status is undefined', () => {
      expect(new ApiError('nope').isNotFound()).toBe(false);
    });
  });

  // --- isRateLimited ---
  describe('isRateLimited', () => {
    it('returns true for 429', () => {
      expect(new ApiError('slow', 429).isRateLimited()).toBe(true);
    });

    it('returns false for 500', () => {
      expect(new ApiError('slow', 500).isRateLimited()).toBe(false);
    });

    it('returns false when status is undefined', () => {
      expect(new ApiError('slow').isRateLimited()).toBe(false);
    });
  });
});
