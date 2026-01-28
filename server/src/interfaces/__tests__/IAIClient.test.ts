import { describe, it, expect } from 'vitest';
import { AIClientError } from '../IAIClient';

describe('AIClientError', () => {
  describe('error handling', () => {
    it('captures statusCode and originalError', () => {
      const original = new Error('root cause');
      const error = new AIClientError('failed', 503, original);

      expect(error.statusCode).toBe(503);
      expect(error.originalError).toBe(original);
      expect(error.name).toBe('AIClientError');
    });

    it('retains the provided message', () => {
      const error = new AIClientError('bad request', 400);

      expect(error.message).toBe('bad request');
    });
  });

  describe('edge cases', () => {
    it('defaults originalError to null when omitted', () => {
      const error = new AIClientError('missing', 404);

      expect(error.originalError).toBeNull();
    });
  });

  describe('core behavior', () => {
    it('inherits from Error', () => {
      const error = new AIClientError('oops', 500);

      expect(error).toBeInstanceOf(Error);
    });
  });
});
