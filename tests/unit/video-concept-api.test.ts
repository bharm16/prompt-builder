import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZodError } from 'zod';

import { VideoConceptApi } from '@components/VideoConceptBuilder/api/videoConceptApi';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders: vi.fn(),
}));

describe('VideoConceptApi', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    vi.mocked(buildFirebaseAuthHeaders).mockResolvedValue({ Authorization: 'Bearer token' });
  });

  describe('error handling', () => {
    it('throws when API response is not ok', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: vi.fn(),
      });

      await expect(
        VideoConceptApi.validateElements({ subject: 'cat' })
      ).rejects.toThrow('API request failed: Bad Request');
    });

    it('throws ZodError when validateElements response is invalid', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ wrong: 'shape' }),
      });

      await expect(
        VideoConceptApi.validateElements({ subject: 'cat' })
      ).rejects.toThrow(ZodError);
    });

    it('returns default score when compatibility response is malformed', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ unknown: true }),
      });

      const score = await VideoConceptApi.checkCompatibility(
        'subject',
        'cat',
        { subject: 'cat' }
      );

      expect(score).toBe(0.5);
    });
  });

  describe('edge cases', () => {
    it('extracts nested compatibility score when available', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          valid: true,
          compatibility: { score: 0.72 },
        }),
      });

      const score = await VideoConceptApi.checkCompatibility(
        'subject',
        'cat',
        { subject: 'cat' }
      );

      expect(score).toBe(0.72);
    });

    it('returns nested suggestions list when wrapped in a suggestions object', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          suggestions: ['add fog', 'try dawn'],
        }),
      });

      const suggestions = await VideoConceptApi.fetchSuggestions(
        'style',
        'noir',
        { subject: 'cat' },
        'A foggy alley'
      );

      expect(suggestions).toEqual(['add fog', 'try dawn']);
    });
  });

  describe('core behavior', () => {
    it('sends auth headers and optional fields for validation', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ valid: true, conflicts: [] }),
      });

      const result = await VideoConceptApi.validateElements(
        { subject: 'cat' },
        'subject',
        'cat'
      );

      expect(result.valid).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0];
      expect(options?.headers).toEqual(
        expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
        })
      );
      expect(JSON.parse(String(options?.body))).toEqual({
        elements: { subject: 'cat' },
        elementType: 'subject',
        value: 'cat',
      });
    });
  });
});
