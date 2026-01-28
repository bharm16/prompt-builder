import { describe, it, expect } from 'vitest';
import {
  ConvergenceError,
  isConvergenceError,
  type ConvergenceErrorCode,
} from '../errors';

describe('ConvergenceError', () => {
  describe('constructor', () => {
    it('creates error with code as message', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND');

      expect(error.message).toBe('SESSION_NOT_FOUND');
      expect(error.code).toBe('SESSION_NOT_FOUND');
    });

    it('sets name to ConvergenceError', () => {
      const error = new ConvergenceError('SESSION_EXPIRED');

      expect(error.name).toBe('ConvergenceError');
    });

    it('stores details when provided', () => {
      const details = { sessionId: '123', userId: 'user-456' };
      const error = new ConvergenceError('SESSION_NOT_FOUND', details);

      expect(error.details).toEqual(details);
    });

    it('handles undefined details', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND');

      expect(error.details).toBeUndefined();
    });

    it('is instance of Error', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND');

      expect(error).toBeInstanceOf(Error);
    });

    it('has proper stack trace', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ConvergenceError');
    });
  });

  describe('getUserMessage', () => {
    describe('error handling', () => {
      it('returns default message for unknown code', () => {
        const error = new ConvergenceError('UNKNOWN_CODE' as ConvergenceErrorCode);

        expect(error.getUserMessage()).toBe(
          'An unexpected error occurred. Please try again.'
        );
      });
    });

    describe('core behavior', () => {
      it('returns user-friendly message for SESSION_NOT_FOUND', () => {
        const error = new ConvergenceError('SESSION_NOT_FOUND');

        expect(error.getUserMessage()).toBe(
          'Session not found. Please start a new session.'
        );
      });

      it('returns user-friendly message for SESSION_EXPIRED', () => {
        const error = new ConvergenceError('SESSION_EXPIRED');

        expect(error.getUserMessage()).toBe(
          'Your session has expired. Please start a new session.'
        );
      });

      it('returns user-friendly message for ACTIVE_SESSION_EXISTS', () => {
        const error = new ConvergenceError('ACTIVE_SESSION_EXISTS');

        expect(error.getUserMessage()).toBe(
          'You already have an active session. Please resume or abandon it first.'
        );
      });

      it('returns user-friendly message for INSUFFICIENT_CREDITS', () => {
        const error = new ConvergenceError('INSUFFICIENT_CREDITS');

        expect(error.getUserMessage()).toBe(
          'Insufficient credits. Please purchase more credits to continue.'
        );
      });

      it('returns user-friendly message for REGENERATION_LIMIT_EXCEEDED', () => {
        const error = new ConvergenceError('REGENERATION_LIMIT_EXCEEDED');

        expect(error.getUserMessage()).toBe(
          'You have reached the maximum number of regenerations for this dimension.'
        );
      });

      it('returns user-friendly message for DEPTH_ESTIMATION_FAILED', () => {
        const error = new ConvergenceError('DEPTH_ESTIMATION_FAILED');

        expect(error.getUserMessage()).toBe(
          'Failed to estimate depth. Camera motion preview is unavailable.'
        );
      });

      it('returns user-friendly message for IMAGE_GENERATION_FAILED', () => {
        const error = new ConvergenceError('IMAGE_GENERATION_FAILED');

        expect(error.getUserMessage()).toBe(
          'Failed to generate images. Please try again.'
        );
      });

      it('returns user-friendly message for VIDEO_GENERATION_FAILED', () => {
        const error = new ConvergenceError('VIDEO_GENERATION_FAILED');

        expect(error.getUserMessage()).toBe(
          'Failed to generate video preview. Please try again.'
        );
      });

      it('returns user-friendly message for INCOMPLETE_SESSION', () => {
        const error = new ConvergenceError('INCOMPLETE_SESSION');

        expect(error.getUserMessage()).toBe(
          'Please complete all required selections before finalizing.'
        );
      });

      it('returns user-friendly message for UNAUTHORIZED', () => {
        const error = new ConvergenceError('UNAUTHORIZED');

        expect(error.getUserMessage()).toBe(
          'You are not authorized to access this session.'
        );
      });

      it('returns user-friendly message for INVALID_REQUEST', () => {
        const error = new ConvergenceError('INVALID_REQUEST');

        expect(error.getUserMessage()).toBe(
          'Invalid request. Please check your inputs.'
        );
      });
    });
  });

  describe('getHttpStatus', () => {
    describe('error handling', () => {
      it('returns 500 for unknown code', () => {
        const error = new ConvergenceError('UNKNOWN_CODE' as ConvergenceErrorCode);

        expect(error.getHttpStatus()).toBe(500);
      });
    });

    describe('core behavior', () => {
      it('returns 404 for SESSION_NOT_FOUND', () => {
        const error = new ConvergenceError('SESSION_NOT_FOUND');

        expect(error.getHttpStatus()).toBe(404);
      });

      it('returns 410 (Gone) for SESSION_EXPIRED', () => {
        const error = new ConvergenceError('SESSION_EXPIRED');

        expect(error.getHttpStatus()).toBe(410);
      });

      it('returns 409 (Conflict) for ACTIVE_SESSION_EXISTS', () => {
        const error = new ConvergenceError('ACTIVE_SESSION_EXISTS');

        expect(error.getHttpStatus()).toBe(409);
      });

      it('returns 402 (Payment Required) for INSUFFICIENT_CREDITS', () => {
        const error = new ConvergenceError('INSUFFICIENT_CREDITS');

        expect(error.getHttpStatus()).toBe(402);
      });

      it('returns 429 (Too Many Requests) for REGENERATION_LIMIT_EXCEEDED', () => {
        const error = new ConvergenceError('REGENERATION_LIMIT_EXCEEDED');

        expect(error.getHttpStatus()).toBe(429);
      });

      it('returns 502 (Bad Gateway) for external service failures', () => {
        expect(new ConvergenceError('DEPTH_ESTIMATION_FAILED').getHttpStatus()).toBe(502);
        expect(new ConvergenceError('IMAGE_GENERATION_FAILED').getHttpStatus()).toBe(502);
        expect(new ConvergenceError('VIDEO_GENERATION_FAILED').getHttpStatus()).toBe(502);
      });

      it('returns 400 (Bad Request) for INCOMPLETE_SESSION', () => {
        const error = new ConvergenceError('INCOMPLETE_SESSION');

        expect(error.getHttpStatus()).toBe(400);
      });

      it('returns 403 (Forbidden) for UNAUTHORIZED', () => {
        const error = new ConvergenceError('UNAUTHORIZED');

        expect(error.getHttpStatus()).toBe(403);
      });

      it('returns 400 (Bad Request) for INVALID_REQUEST', () => {
        const error = new ConvergenceError('INVALID_REQUEST');

        expect(error.getHttpStatus()).toBe(400);
      });
    });
  });

  describe('toJSON', () => {
    describe('core behavior', () => {
      it('returns serializable object with name', () => {
        const error = new ConvergenceError('SESSION_NOT_FOUND');

        expect(error.toJSON().name).toBe('ConvergenceError');
      });

      it('returns serializable object with code', () => {
        const error = new ConvergenceError('SESSION_EXPIRED');

        expect(error.toJSON().code).toBe('SESSION_EXPIRED');
      });

      it('returns serializable object with user-friendly message', () => {
        const error = new ConvergenceError('INSUFFICIENT_CREDITS');
        const json = error.toJSON();

        expect(json.message).toBe(
          'Insufficient credits. Please purchase more credits to continue.'
        );
      });

      it('includes details when provided', () => {
        const details = { requiredCredits: 100, availableCredits: 50 };
        const error = new ConvergenceError('INSUFFICIENT_CREDITS', details);

        expect(error.toJSON().details).toEqual(details);
      });

      it('has undefined details when not provided', () => {
        const error = new ConvergenceError('SESSION_NOT_FOUND');

        expect(error.toJSON().details).toBeUndefined();
      });

      it('can be serialized with JSON.stringify', () => {
        const details = { sessionId: '123' };
        const error = new ConvergenceError('SESSION_NOT_FOUND', details);

        const jsonString = JSON.stringify(error.toJSON());
        const parsed = JSON.parse(jsonString);

        expect(parsed.name).toBe('ConvergenceError');
        expect(parsed.code).toBe('SESSION_NOT_FOUND');
        expect(parsed.details).toEqual(details);
      });
    });
  });
});

describe('isConvergenceError', () => {
  describe('error handling', () => {
    it('returns false for null', () => {
      expect(isConvergenceError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isConvergenceError(undefined)).toBe(false);
    });

    it('returns false for plain string', () => {
      expect(isConvergenceError('error message')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isConvergenceError(500)).toBe(false);
    });

    it('returns false for plain object', () => {
      expect(isConvergenceError({ code: 'SESSION_NOT_FOUND' })).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('returns false for generic Error', () => {
      expect(isConvergenceError(new Error('generic error'))).toBe(false);
    });

    it('returns false for TypeError', () => {
      expect(isConvergenceError(new TypeError('type error'))).toBe(false);
    });

    it('returns false for SyntaxError', () => {
      expect(isConvergenceError(new SyntaxError('syntax error'))).toBe(false);
    });

    it('returns false for object with similar shape', () => {
      const fake = {
        name: 'ConvergenceError',
        code: 'SESSION_NOT_FOUND',
        getUserMessage: () => 'fake',
        getHttpStatus: () => 404,
      };

      expect(isConvergenceError(fake)).toBe(false);
    });
  });

  describe('core behavior', () => {
    it('returns true for ConvergenceError instance', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND');

      expect(isConvergenceError(error)).toBe(true);
    });

    it('returns true for ConvergenceError with details', () => {
      const error = new ConvergenceError('SESSION_EXPIRED', { sessionId: '123' });

      expect(isConvergenceError(error)).toBe(true);
    });

    it('works as type guard in conditional', () => {
      const maybeError: unknown = new ConvergenceError('INSUFFICIENT_CREDITS');

      if (isConvergenceError(maybeError)) {
        // TypeScript should know this is a ConvergenceError
        expect(maybeError.code).toBe('INSUFFICIENT_CREDITS');
        expect(maybeError.getUserMessage()).toBeDefined();
      } else {
        // This branch should not execute
        expect(true).toBe(false);
      }
    });
  });
});
