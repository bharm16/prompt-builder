import { describe, it, expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import { enforceVideoMode } from '../enforceVideoMode';

function createMockRequest(body: unknown = {}): Request {
  return { body } as Request;
}

function createMockResponse(): Response {
  return {} as Response;
}

describe('enforceVideoMode', () => {
  describe('error handling', () => {
    it('handles null body by creating object with video mode', () => {
      const req = createMockRequest(null);
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body).toEqual({ mode: 'video' });
    });

    it('handles undefined body by creating object with video mode', () => {
      const req = { body: undefined } as Request;
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body).toEqual({ mode: 'video' });
    });

    it('handles string body by creating object with video mode', () => {
      const req = createMockRequest('invalid');
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body).toEqual({ mode: 'video' });
    });

    it('adds mode to array body (arrays are objects in JS)', () => {
      // NOTE: In JavaScript, typeof [] === 'object', so arrays pass the
      // typeof check. The middleware adds mode property to the array.
      // This is arguably a bug, but this test documents the actual behavior.
      const req = createMockRequest([1, 2, 3]);
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      // Array gets mode added as a property (not ideal but actual behavior)
      expect(req.body.mode).toBe('video');
      expect(Array.isArray(req.body)).toBe(true);
    });

    it('handles number body by creating object with video mode', () => {
      const req = createMockRequest(123);
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body).toEqual({ mode: 'video' });
    });
  });

  describe('edge cases', () => {
    it('overrides incorrect mode value', () => {
      const req = createMockRequest({ mode: 'image' });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });

    it('overrides empty string mode', () => {
      const req = createMockRequest({ mode: '' });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });

    it('overrides null mode', () => {
      const req = createMockRequest({ mode: null });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });

    it('overrides undefined mode', () => {
      const req = createMockRequest({ mode: undefined });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });

    it('handles empty object body', () => {
      const req = createMockRequest({});
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });
  });

  describe('core behavior', () => {
    it('preserves video mode when already set', () => {
      const req = createMockRequest({ mode: 'video' });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body.mode).toBe('video');
    });

    it('preserves other body properties', () => {
      const req = createMockRequest({
        mode: 'image',
        prompt: 'test prompt',
        options: { key: 'value' },
      });
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(req.body).toEqual({
        mode: 'video',
        prompt: 'test prompt',
        options: { key: 'value' },
      });
    });

    it('calls next after modifying body', () => {
      const req = createMockRequest({});
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not pass error to next on success', () => {
      const req = createMockRequest({});
      const next = vi.fn();

      enforceVideoMode(req, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith();
    });
  });
});
