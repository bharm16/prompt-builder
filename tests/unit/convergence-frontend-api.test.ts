/**
 * Unit tests for convergenceApi error handling
 *
 * Tests the API layer error handling including ConvergenceError parsing,
 * HTTP status code mapping, and AbortController support.
 *
 * Requirements tested:
 * - 10.2: Throw errors with response messages on non-OK responses
 * - 10.5: Support request cancellation via AbortController
 * - 11.1-11.8: Error handling and recovery
 *
 * Task: 33.5 Test convergenceApi error handling
 *
 * @module convergence-frontend-api.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConvergenceError } from '@features/convergence/api/convergenceApi';
import type { ConvergenceErrorCode, ConvergenceApiError } from '@features/convergence/types';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the firebase auth headers
vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders: vi.fn(async () => ({
    Authorization: 'Bearer mock-token',
  })),
}));

// Mock the API config
vi.mock('@/config/api.config', () => ({
  API_CONFIG: {
    baseURL: 'http://localhost:3000/api',
  },
}));

// Store original fetch
const originalFetch = global.fetch;

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock Response object
 */
function createMockResponse(
  body: unknown,
  options: { status?: number; statusText?: string; ok?: boolean } = {}
): Response {
  const { status = 200, statusText = 'OK', ok = status >= 200 && status < 300 } = options;

  return {
    ok,
    status,
    statusText,
    json: vi.fn(async () => body),
    text: vi.fn(async () => JSON.stringify(body)),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: '',
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
  } as unknown as Response;
}


// ============================================================================
// Tests
// ============================================================================

describe('ConvergenceError', () => {
  describe('Constructor', () => {
    it('should create error with code and message', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND', 'Session not found');

      expect(error.code).toBe('SESSION_NOT_FOUND');
      expect(error.message).toBe('Session not found');
      expect(error.name).toBe('ConvergenceError');
      expect(error.details).toBeUndefined();
    });

    it('should create error with details', () => {
      const error = new ConvergenceError('INSUFFICIENT_CREDITS', 'Not enough credits', {
        required: 10,
        available: 5,
      });

      expect(error.code).toBe('INSUFFICIENT_CREDITS');
      expect(error.message).toBe('Not enough credits');
      expect(error.details).toEqual({ required: 10, available: 5 });
    });

    it('should be instanceof Error', () => {
      const error = new ConvergenceError('SESSION_NOT_FOUND', 'Session not found');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConvergenceError);
    });
  });

  describe('fromApiError', () => {
    it('should create error from API error response', () => {
      const apiError: ConvergenceApiError = {
        code: 'UNAUTHORIZED',
        message: 'You are not authorized',
      };

      const error = ConvergenceError.fromApiError(apiError);

      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('You are not authorized');
    });

    it('should preserve details from API error', () => {
      const apiError: ConvergenceApiError = {
        code: 'INSUFFICIENT_CREDITS',
        message: 'Not enough credits',
        details: { required: 20, available: 10 },
      };

      const error = ConvergenceError.fromApiError(apiError);

      expect(error.details).toEqual({ required: 20, available: 10 });
    });
  });

  describe('Error Codes', () => {
    const errorCodes: ConvergenceErrorCode[] = [
      'SESSION_NOT_FOUND',
      'SESSION_EXPIRED',
      'ACTIVE_SESSION_EXISTS',
      'INSUFFICIENT_CREDITS',
      'REGENERATION_LIMIT_EXCEEDED',
      'DEPTH_ESTIMATION_FAILED',
      'IMAGE_GENERATION_FAILED',
      'VIDEO_GENERATION_FAILED',
      'INCOMPLETE_SESSION',
      'UNAUTHORIZED',
    ];

    it.each(errorCodes)('should handle %s error code', (code) => {
      const error = new ConvergenceError(code, `Error: ${code}`);

      expect(error.code).toBe(code);
      expect(error.message).toBe(`Error: ${code}`);
    });
  });
});

describe('convergenceApi Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('HTTP Status Code Mapping', () => {
    it('should map 401 to UNAUTHORIZED', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { status: 401, statusText: 'Unauthorized', ok: false })
      );

      // Import the API module after mocking
      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('UNAUTHORIZED');
      }
    });

    it('should map 403 to UNAUTHORIZED', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { status: 403, statusText: 'Forbidden', ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('UNAUTHORIZED');
      }
    });

    it('should map 404 to SESSION_NOT_FOUND', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { status: 404, statusText: 'Not Found', ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('SESSION_NOT_FOUND');
      }
    });

    it('should map 409 to ACTIVE_SESSION_EXISTS', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { status: 409, statusText: 'Conflict', ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('ACTIVE_SESSION_EXISTS');
      }
    });

    it('should map 402 to INSUFFICIENT_CREDITS', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({}, { status: 402, statusText: 'Payment Required', ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('INSUFFICIENT_CREDITS');
      }
    });
  });


  describe('API Error Response Parsing', () => {
    it('should parse ConvergenceApiError from response body', async () => {
      const apiError: ConvergenceApiError = {
        code: 'REGENERATION_LIMIT_EXCEEDED',
        message: 'Maximum regenerations reached',
        details: { dimension: 'mood', limit: 3 },
      };

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse(apiError, { status: 400, ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).code).toBe('REGENERATION_LIMIT_EXCEEDED');
        expect((error as ConvergenceError).message).toBe('Maximum regenerations reached');
        expect((error as ConvergenceError).details).toEqual({ dimension: 'mood', limit: 3 });
      }
    });

    it('should handle generic error format with error field', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse({ error: 'Something went wrong' }, { status: 500, ok: false })
      );

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);

      try {
        await startSession('test intent');
      } catch (error) {
        expect((error as ConvergenceError).message).toBe('Something went wrong');
      }
    });

    it('should handle non-JSON error response', async () => {
      const mockResponse = createMockResponse(null, { status: 500, statusText: 'Internal Server Error', ok: false });
      (mockResponse.json as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Invalid JSON'));

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const { startSession } = await import('@features/convergence/api/convergenceApi');

      await expect(startSession('test intent')).rejects.toThrow(ConvergenceError);
    });
  });

  describe('AbortController Support', () => {
    it('should pass AbortSignal to fetch', async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        createMockResponse({
          sessionId: 'test-session',
          images: [],
          currentDimension: 'direction',
          options: [],
          estimatedCost: 4,
        })
      );
      global.fetch = mockFetch;

      const { startSession } = await import('@features/convergence/api/convergenceApi');
      const controller = new AbortController();

      await startSession('test intent', undefined, controller.signal);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it('should throw AbortError when request is cancelled', async () => {
      const abortError = new DOMException('The operation was aborted', 'AbortError');
      global.fetch = vi.fn().mockRejectedValue(abortError);

      const { startSession } = await import('@features/convergence/api/convergenceApi');
      const controller = new AbortController();
      controller.abort();

      await expect(startSession('test intent', undefined, controller.signal)).rejects.toThrow('The operation was aborted');
    });
  });

  describe('getActiveSession Error Handling', () => {
    it('should return null when SESSION_NOT_FOUND', async () => {
      const apiError: ConvergenceApiError = {
        code: 'SESSION_NOT_FOUND',
        message: 'No active session found',
      };

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse(apiError, { status: 404, ok: false })
      );

      const { getActiveSession } = await import('@features/convergence/api/convergenceApi');

      const result = await getActiveSession();

      expect(result).toBeNull();
    });

    it('should throw for other errors', async () => {
      const apiError: ConvergenceApiError = {
        code: 'UNAUTHORIZED',
        message: 'Not authorized',
      };

      global.fetch = vi.fn().mockResolvedValue(
        createMockResponse(apiError, { status: 401, ok: false })
      );

      const { getActiveSession } = await import('@features/convergence/api/convergenceApi');

      await expect(getActiveSession()).rejects.toThrow(ConvergenceError);
    });
  });


  describe('API Methods', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    describe('startSession', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            images: [],
            currentDimension: 'direction',
            options: [],
            estimatedCost: 4,
          })
        );
        global.fetch = mockFetch;

        const { startSession } = await import('@features/convergence/api/convergenceApi');

        await startSession('A beautiful sunset');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/start',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ intent: 'A beautiful sunset' }),
          })
        );
      });

      it('should include aspectRatio when provided', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            images: [],
            currentDimension: 'direction',
            options: [],
            estimatedCost: 4,
          })
        );
        global.fetch = mockFetch;

        const { startSession } = await import('@features/convergence/api/convergenceApi');

        await startSession('A beautiful sunset', '16:9');

        expect(mockFetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({ intent: 'A beautiful sunset', aspectRatio: '16:9' }),
          })
        );
      });
    });

    describe('selectOption', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            images: [],
            currentDimension: 'mood',
            lockedDimensions: [],
            creditsConsumed: 4,
          })
        );
        global.fetch = mockFetch;

        const { selectOption } = await import('@features/convergence/api/convergenceApi');

        await selectOption('session-123', 'direction', 'cinematic');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/select',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              sessionId: 'session-123',
              dimension: 'direction',
              optionId: 'cinematic',
            }),
          })
        );
      });
    });

    describe('regenerate', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            images: [],
            remainingRegenerations: 2,
            creditsConsumed: 4,
          })
        );
        global.fetch = mockFetch;

        const { regenerate } = await import('@features/convergence/api/convergenceApi');

        await regenerate('session-123', 'mood');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/regenerate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              sessionId: 'session-123',
              dimension: 'mood',
            }),
          })
        );
      });
    });

    describe('generateCameraMotion', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            depthMapUrl: 'https://storage.googleapis.com/depth.png',
            cameraPaths: [],
            fallbackMode: false,
            creditsConsumed: 1,
          })
        );
        global.fetch = mockFetch;

        const { generateCameraMotion } = await import('@features/convergence/api/convergenceApi');

        await generateCameraMotion('session-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/camera-motion',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ sessionId: 'session-123' }),
          })
        );
      });
    });

    describe('selectCameraMotion', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(createMockResponse({}));
        global.fetch = mockFetch;

        const { selectCameraMotion } = await import('@features/convergence/api/convergenceApi');

        await selectCameraMotion('session-123', 'push_in');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/camera-motion/select',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              sessionId: 'session-123',
              cameraMotionId: 'push_in',
            }),
          })
        );
      });
    });

    describe('generateSubjectMotion', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            videoUrl: 'https://storage.googleapis.com/video.mp4',
            prompt: 'Final prompt',
            creditsConsumed: 5,
          })
        );
        global.fetch = mockFetch;

        const { generateSubjectMotion } = await import('@features/convergence/api/convergenceApi');

        await generateSubjectMotion('session-123', 'walking slowly');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/subject-motion',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              sessionId: 'session-123',
              subjectMotion: 'walking slowly',
            }),
          })
        );
      });
    });

    describe('finalizeSession', () => {
      it('should send correct request body', async () => {
        const mockFetch = vi.fn().mockResolvedValue(
          createMockResponse({
            sessionId: 'test-session',
            finalPrompt: 'Complete prompt',
            lockedDimensions: [],
            previewImageUrl: 'https://storage.googleapis.com/preview.png',
            cameraMotion: 'push_in',
            subjectMotion: '',
            totalCreditsConsumed: 22,
            generationCosts: {},
          })
        );
        global.fetch = mockFetch;

        const { finalizeSession } = await import('@features/convergence/api/convergenceApi');

        await finalizeSession('session-123');

        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:3000/api/convergence/finalize',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ sessionId: 'session-123' }),
          })
        );
      });
    });
  });
});
