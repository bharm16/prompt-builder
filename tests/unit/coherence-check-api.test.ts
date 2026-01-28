import { describe, it, expect, beforeEach, vi } from 'vitest';

import { checkPromptCoherence } from '@features/prompt-optimizer/api/coherenceCheckApi';
import { buildFirebaseAuthHeaders } from '@/services/http/firebaseAuth';

vi.mock('@/services/http/firebaseAuth', () => ({
  buildFirebaseAuthHeaders: vi.fn(),
}));

const mockBuildFirebaseAuthHeaders = vi.mocked(buildFirebaseAuthHeaders);

describe('checkPromptCoherence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error handling', () => {
    it('throws when fetch is unavailable', async () => {
      const originalFetch = globalThis.fetch;
      // @ts-expect-error intentionally removing fetch for test
      delete (globalThis as { fetch?: typeof fetch }).fetch;

      await expect(
        checkPromptCoherence({ prompt: 'test' })
      ).rejects.toThrow('Fetch is not available in this environment.');

      globalThis.fetch = originalFetch;
    });

    it('throws when the response is not ok', async () => {
      mockBuildFirebaseAuthHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        checkPromptCoherence({ prompt: 'test' }, { fetchImpl })
      ).rejects.toThrow('Failed to check coherence: 500');
    });
  });

  describe('core behavior', () => {
    it('returns parsed JSON for successful responses', async () => {
      mockBuildFirebaseAuthHeaders.mockResolvedValue({ Authorization: 'Bearer token' });
      const fetchImpl = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ issues: [] }),
      });

      const result = await checkPromptCoherence({ prompt: 'test' }, { fetchImpl });

      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/check-prompt-coherence',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer token',
          }),
        })
      );
      expect(result).toEqual({ issues: [] });
    });
  });
});
