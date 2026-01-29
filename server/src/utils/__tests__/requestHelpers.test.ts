import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { extractUserId, extractRequestMetadata } from '../requestHelpers';

const mockRequest = (overrides: Record<string, unknown> = {}): Request =>
  ({
    method: 'GET',
    path: '/test',
    ip: '127.0.0.1',
    body: {},
    ...overrides,
  }) as unknown as Request;

describe('extractUserId', () => {
  describe('priority order', () => {
    it('returns Firebase user uid when present', () => {
      const req = mockRequest({ user: { uid: 'firebase-uid-123' } });
      expect(extractUserId(req)).toBe('firebase-uid-123');
    });

    it('returns apiKey when no Firebase user', () => {
      const req = mockRequest({ apiKey: 'api-key-456' });
      expect(extractUserId(req)).toBe('api-key-456');
    });

    it('returns body userId when no Firebase user or apiKey', () => {
      const req = mockRequest({ body: { userId: 'body-user-789' } });
      expect(extractUserId(req)).toBe('body-user-789');
    });

    it('returns anonymous when no auth source available', () => {
      const req = mockRequest();
      expect(extractUserId(req)).toBe('anonymous');
    });
  });

  describe('edge cases', () => {
    it('prefers Firebase user over apiKey', () => {
      const req = mockRequest({
        user: { uid: 'firebase-uid' },
        apiKey: 'api-key',
        body: { userId: 'body-user' },
      });
      expect(extractUserId(req)).toBe('firebase-uid');
    });

    it('prefers apiKey over body userId', () => {
      const req = mockRequest({
        apiKey: 'api-key',
        body: { userId: 'body-user' },
      });
      expect(extractUserId(req)).toBe('api-key');
    });

    it('returns anonymous when user object exists but uid is undefined', () => {
      const req = mockRequest({ user: {} });
      expect(extractUserId(req)).toBe('anonymous');
    });
  });
});

describe('extractRequestMetadata', () => {
  describe('core behavior', () => {
    it('extracts all standard metadata fields', () => {
      const req = mockRequest({
        id: 'req-123',
        user: { uid: 'user-456' },
        method: 'POST',
        path: '/api/optimize',
        ip: '192.168.1.1',
      });

      const metadata = extractRequestMetadata(req);
      expect(metadata.requestId).toBe('req-123');
      expect(metadata.userId).toBe('user-456');
      expect(metadata.method).toBe('POST');
      expect(metadata.path).toBe('/api/optimize');
      expect(metadata.ip).toBe('192.168.1.1');
    });
  });

  describe('edge cases', () => {
    it('returns undefined requestId when id not set', () => {
      const req = mockRequest();
      const metadata = extractRequestMetadata(req);
      expect(metadata.requestId).toBeUndefined();
    });

    it('returns anonymous userId when no auth present', () => {
      const req = mockRequest();
      const metadata = extractRequestMetadata(req);
      expect(metadata.userId).toBe('anonymous');
    });
  });
});
