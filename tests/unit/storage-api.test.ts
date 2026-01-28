import { describe, it, expect, vi, beforeEach } from 'vitest';

import { storageApi } from '@/api/storageApi';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';
import { API_CONFIG } from '@/config/api.config';

vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders: vi.fn(),
}));

vi.mock('@/config/api.config', () => ({
  API_CONFIG: { baseURL: 'https://example.com' },
}));

describe('storageApi', () => {
  const mockBuildHeaders = vi.mocked(buildFirebaseAuthHeaders);

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  describe('error handling', () => {
    it('throws the payload error message when response is not ok', async () => {
      mockBuildHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      (global.fetch as typeof fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'No access' }),
      } as Response);

      await expect(storageApi.getUsage()).rejects.toThrow('No access');
    });

    it('falls back to a default error message when payload has no details', async () => {
      mockBuildHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      (global.fetch as typeof fetch).mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      await expect(storageApi.deleteFile('path/to/file')).rejects.toThrow('Storage API error');
    });
  });

  describe('edge cases', () => {
    it('builds query params for listFiles', async () => {
      mockBuildHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      (global.fetch as typeof fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { items: [] } }),
      } as Response);

      const result = await storageApi.listFiles({ type: 'image', limit: 5, cursor: 'abc' });

      expect(result).toEqual({ items: [] });
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseURL}/storage/list?type=image&limit=5&cursor=abc`,
        expect.any(Object)
      );
    });

    it('includes filename in download URL query', async () => {
      mockBuildHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      (global.fetch as typeof fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { downloadUrl: 'url' } }),
      } as Response);

      const result = await storageApi.getDownloadUrl('path/to/file', 'my-file.txt');

      expect(result).toEqual({ downloadUrl: 'url' });
      expect(global.fetch).toHaveBeenCalledWith(
        `${API_CONFIG.baseURL}/storage/download-url?path=path%2Fto%2Ffile&filename=my-file.txt`,
        expect.any(Object)
      );
    });
  });

  describe('core behavior', () => {
    it('returns data payloads on successful responses', async () => {
      mockBuildHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      (global.fetch as typeof fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { viewUrl: 'https://example.com/view' } }),
      } as Response);

      const result = await storageApi.getViewUrl('path/asset.png');

      expect(result).toEqual({ viewUrl: 'https://example.com/view' });
    });
  });
});
