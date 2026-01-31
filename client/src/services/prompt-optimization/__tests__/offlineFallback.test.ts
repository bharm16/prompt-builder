/**
 * Unit tests for offlineFallback utilities
 *
 * Tests error classification, offline result generation, and callback emission.
 */

import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../http/ApiError';
import {
  shouldUseOfflineFallback,
  isAbortError,
  buildOfflineResult,
  handleOfflineFallback,
  emitOfflineCallbacks,
} from '../offlineFallback';

// ---------------------------------------------------------------------------
// shouldUseOfflineFallback - error classification
// ---------------------------------------------------------------------------
describe('shouldUseOfflineFallback', () => {
  it('returns true for error with status 401', () => {
    const error = Object.assign(new Error('fail'), { status: 401 });
    expect(shouldUseOfflineFallback(error)).toBe(true);
  });

  it('returns true for error with status 403', () => {
    const error = Object.assign(new Error('fail'), { status: 403 });
    expect(shouldUseOfflineFallback(error)).toBe(true);
  });

  it('returns true for error with nested response.status 401', () => {
    const error = Object.assign(new Error('fail'), { response: { status: 401 } });
    expect(shouldUseOfflineFallback(error)).toBe(true);
  });

  it('returns true for error with nested response.status 403', () => {
    const error = Object.assign(new Error('fail'), { response: { status: 403 } });
    expect(shouldUseOfflineFallback(error)).toBe(true);
  });

  it('returns true for ApiError with status 401', () => {
    expect(shouldUseOfflineFallback(new ApiError('Unauthorized', 401))).toBe(true);
  });

  it('returns true for ApiError with status 403', () => {
    expect(shouldUseOfflineFallback(new ApiError('Forbidden', 403))).toBe(true);
  });

  it('returns true when message contains "401"', () => {
    expect(shouldUseOfflineFallback(new Error('HTTP 401 response'))).toBe(true);
  });

  it('returns true when message contains "unauthorized" (case-insensitive)', () => {
    expect(shouldUseOfflineFallback(new Error('Request was Unauthorized'))).toBe(true);
  });

  it('returns true when message contains "permission"', () => {
    expect(shouldUseOfflineFallback(new Error('Insufficient permission'))).toBe(true);
  });

  it('returns false for null', () => {
    expect(shouldUseOfflineFallback(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(shouldUseOfflineFallback(undefined)).toBe(false);
  });

  it('returns false for falsy values like 0 and empty string', () => {
    expect(shouldUseOfflineFallback(0)).toBe(false);
    expect(shouldUseOfflineFallback('')).toBe(false);
  });

  it('returns false for 500 server error', () => {
    expect(
      shouldUseOfflineFallback(Object.assign(new Error('fail'), { status: 500 })),
    ).toBe(false);
  });

  it('returns false for 404 not found', () => {
    expect(
      shouldUseOfflineFallback(Object.assign(new Error('Not found'), { status: 404 })),
    ).toBe(false);
  });

  it('returns false for generic error without auth keywords', () => {
    expect(shouldUseOfflineFallback(new Error('Network timeout'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isAbortError
// ---------------------------------------------------------------------------
describe('isAbortError', () => {
  it('returns false for null', () => {
    expect(isAbortError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAbortError(undefined)).toBe(false);
  });

  it('returns false for non-object values', () => {
    expect(isAbortError('AbortError')).toBe(false);
    expect(isAbortError(42)).toBe(false);
  });

  it('returns false for generic error', () => {
    expect(isAbortError(new Error('timeout'))).toBe(false);
  });

  it('returns true for DOMException with name AbortError', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
  });

  it('returns true for plain object with name AbortError', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
  });

  it('returns true for object with code ABORT_ERR', () => {
    expect(isAbortError({ code: 'ABORT_ERR' })).toBe(true);
  });

  it('returns false for object without abort indicators', () => {
    expect(isAbortError({ name: 'TypeError', code: 'ERR_NETWORK' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildOfflineResult
// ---------------------------------------------------------------------------
describe('buildOfflineResult', () => {
  it('includes error message in metadata when error is an Error', () => {
    const result = buildOfflineResult(
      { prompt: 'test', mode: 'optimize', signal: undefined },
      new Error('Auth failed'),
    );
    expect(result.metadata.errorMessage).toBe('Auth failed');
  });

  it('sets errorMessage to null when error is null', () => {
    const result = buildOfflineResult(
      { prompt: 'test', mode: 'optimize', signal: undefined },
      null,
    );
    expect(result.metadata.errorMessage).toBeNull();
  });

  it('handles empty prompt by showing fallback text', () => {
    const result = buildOfflineResult(
      { prompt: '', mode: 'optimize', signal: undefined },
      new Error('test'),
    );
    expect(result.draft).toContain('No original prompt was provided.');
  });

  it('handles undefined prompt gracefully', () => {
    const result = buildOfflineResult(
      { prompt: undefined as unknown as string, mode: 'optimize', signal: undefined },
      new Error('test'),
    );
    expect(result.draft).toContain('No original prompt was provided.');
  });

  it('normalizes mode with hyphens to spaces', () => {
    const result = buildOfflineResult(
      { prompt: 'hello', mode: 'scene-change', signal: undefined },
      new Error('e'),
    );
    expect(result.draft).toContain('scene change');
    expect(result.draft).not.toContain('scene-change');
  });

  it('defaults mode to "optimize" when mode is falsy', () => {
    const result = buildOfflineResult(
      { prompt: 'hello', mode: '', signal: undefined },
      new Error('e'),
    );
    expect(result.draft).toContain('optimize');
  });

  it('produces a complete offline result structure', () => {
    const result = buildOfflineResult(
      { prompt: 'A cinematic scene', mode: 'video-prompt', signal: undefined },
      new Error('401'),
    );
    expect(result.draft).toContain('A cinematic scene');
    expect(result.refined).toContain('A cinematic scene');
    expect(result.refined).toContain('locally generated');
    expect(result.spans).toEqual([]);
    expect(result.usedFallback).toBe(true);
    expect(result.metadata).toEqual(
      expect.objectContaining({ usedFallback: true, offline: true, reason: 'unauthorized' }),
    );
  });

  it('refined text contains draft text', () => {
    const result = buildOfflineResult(
      { prompt: 'test prompt', mode: 'optimize', signal: undefined },
      new Error('err'),
    );
    expect(result.refined).toContain(result.draft);
  });
});

// ---------------------------------------------------------------------------
// emitOfflineCallbacks
// ---------------------------------------------------------------------------
describe('emitOfflineCallbacks', () => {
  it('does not throw when callbacks are undefined', () => {
    const result = buildOfflineResult(
      { prompt: 'x', mode: 'o', signal: undefined },
      null,
    );
    expect(() => emitOfflineCallbacks(result, {})).not.toThrow();
  });

  it('does not throw when callbacks are null', () => {
    const result = buildOfflineResult(
      { prompt: 'x', mode: 'o', signal: undefined },
      null,
    );
    expect(() =>
      emitOfflineCallbacks(result, { onDraft: null, onSpans: null, onRefined: null }),
    ).not.toThrow();
  });

  it('calls onDraft with the draft text', () => {
    const onDraft = vi.fn();
    const result = buildOfflineResult(
      { prompt: 'abc', mode: 'optimize', signal: undefined },
      null,
    );
    emitOfflineCallbacks(result, { onDraft });
    expect(onDraft).toHaveBeenCalledWith(result.draft);
  });

  it('calls onSpans with empty array and offline-fallback source', () => {
    const onSpans = vi.fn();
    const result = buildOfflineResult(
      { prompt: 'abc', mode: 'optimize', signal: undefined },
      null,
    );
    emitOfflineCallbacks(result, { onSpans });
    expect(onSpans).toHaveBeenCalledWith([], 'offline-fallback', result.metadata);
  });

  it('calls onRefined with refined text and metadata', () => {
    const onRefined = vi.fn();
    const result = buildOfflineResult(
      { prompt: 'abc', mode: 'optimize', signal: undefined },
      null,
    );
    emitOfflineCallbacks(result, { onRefined });
    expect(onRefined).toHaveBeenCalledWith(result.refined, result.metadata);
  });
});

// ---------------------------------------------------------------------------
// handleOfflineFallback (integration of build + emit)
// ---------------------------------------------------------------------------
describe('handleOfflineFallback', () => {
  it('returns a complete result with usedFallback true', () => {
    const result = handleOfflineFallback(
      { prompt: 'test', mode: 'optimize', signal: undefined },
      new Error('401'),
    );
    expect(result.usedFallback).toBe(true);
    expect(result.draft).toBeTruthy();
    expect(result.refined).toBeTruthy();
    expect(result.spans).toEqual([]);
  });

  it('emits onDraft and onRefined callbacks', () => {
    const onDraft = vi.fn();
    const onRefined = vi.fn();
    handleOfflineFallback(
      { prompt: 'test', mode: 'optimize', onDraft, onRefined, signal: undefined },
      new Error('401'),
    );
    expect(onDraft).toHaveBeenCalled();
    expect(onRefined).toHaveBeenCalled();
  });

  it('includes the prompt text in draft output', () => {
    const result = handleOfflineFallback(
      { prompt: 'my unique prompt text', mode: 'optimize', signal: undefined },
      new Error('err'),
    );
    expect(result.draft).toContain('my unique prompt text');
  });
});
