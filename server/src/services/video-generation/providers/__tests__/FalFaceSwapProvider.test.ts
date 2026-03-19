import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { FalFaceSwapProvider } from '../FalFaceSwapProvider';

const FAL_ENV_KEYS = ['FAL_KEY', 'FAL_API_KEY', 'FAL_KEY_ID', 'FAL_KEY_SECRET'] as const;
type FalEnvKey = typeof FAL_ENV_KEYS[number];

const ORIGINAL_ENV: Record<FalEnvKey, string | undefined> = {
  FAL_KEY: process.env.FAL_KEY,
  FAL_API_KEY: process.env.FAL_API_KEY,
  FAL_KEY_ID: process.env.FAL_KEY_ID,
  FAL_KEY_SECRET: process.env.FAL_KEY_SECRET,
};

const restoreFalEnv = () => {
  for (const key of FAL_ENV_KEYS) {
    const value = ORIGINAL_ENV[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

const clearFalEnv = () => {
  for (const key of FAL_ENV_KEYS) {
    delete process.env[key];
  }
};

const buildJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const parseRequestBody = (
  fetchMock: MockedFunction<typeof fetch>,
  callIndex = 0
): Record<string, unknown> => {
  const init = fetchMock.mock.calls[callIndex]?.[1];
  const body = init?.body;
  if (typeof body !== 'string') {
    throw new Error('Expected request body to be a string');
  }
  return JSON.parse(body) as Record<string, unknown>;
};

const mockQueueSuccess = (
  fetchMock: MockedFunction<typeof fetch>,
  resultPayload: Record<string, unknown>
) => {
  fetchMock
    .mockResolvedValueOnce(
      buildJsonResponse({
        request_id: 'req-1',
        status_url: 'https://queue.fal.run/status/req-1',
        response_url: 'https://queue.fal.run/response/req-1',
      })
    )
    .mockResolvedValueOnce(buildJsonResponse({ status: 'COMPLETED' }))
    .mockResolvedValueOnce(buildJsonResponse(resultPayload));
};

describe('FalFaceSwapProvider', () => {
  let fetchMock: MockedFunction<typeof fetch>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn();
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchMock;
  });

  afterEach(() => {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = originalFetch;
    restoreFalEnv();
  });

  describe('error handling', () => {
    it('reports availability when FAL_KEY is set', () => {
      process.env.FAL_KEY = 'fal-key';
      const provider = new FalFaceSwapProvider();
      expect(provider.isAvailable()).toBe(true);
    });

    it('throws when the provider is not configured', async () => {
      clearFalEnv();
      const provider = new FalFaceSwapProvider();

      await expect(
        provider.swapFace({
          faceImageUrl: 'https://images.example.com/face.webp',
          targetImageUrl: 'https://images.example.com/target.webp',
        })
      ).rejects.toThrow('Fal.ai provider is not configured. Set FAL_KEY or FAL_API_KEY.');
    });

    it('throws when the face image URL is missing', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });

      await expect(
        provider.swapFace({
          faceImageUrl: '',
          targetImageUrl: 'https://images.example.com/target.webp',
        })
      ).rejects.toThrow('Face reference image URL is required');
    });

    it('throws when the target image URL is missing', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });

      await expect(
        provider.swapFace({
          faceImageUrl: 'https://images.example.com/face.webp',
          targetImageUrl: '',
        })
      ).rejects.toThrow('Target composition image URL is required');
    });

    it('throws when provided URLs are invalid', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });

      await expect(
        provider.swapFace({
          faceImageUrl: 'not-a-url',
          targetImageUrl: 'https://images.example.com/target.webp',
        })
      ).rejects.toThrow(/Invalid URL/);
    });

    it('wraps fal submission errors', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });

      fetchMock.mockResolvedValueOnce(
        new Response('Bad request', {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        })
      );

      await expect(
        provider.swapFace({
          faceImageUrl: 'https://images.example.com/face.webp',
          targetImageUrl: 'https://images.example.com/target.webp',
        })
      ).rejects.toThrow(/Face swap failed: Fal API submission failed/);
    });
  });

  describe('core behavior', () => {
    it('submits to the correct fal endpoint with defaults', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, {
        image: {
          url: 'https://images.example.com/swapped.webp',
          width: 1024,
          height: 768,
          content_type: 'image/webp',
        },
      });

      const result = await provider.swapFace({
        faceImageUrl: 'https://images.example.com/face.webp',
        targetImageUrl: 'https://images.example.com/target.webp',
      });

      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(fetchMock.mock.calls[0]?.[0]).toBe('https://queue.fal.run/easel-ai/advanced-face-swap');

      const input = parseRequestBody(fetchMock);
      expect(input.face_image_0).toBe('https://images.example.com/face.webp');
      expect(input.target_image).toBe('https://images.example.com/target.webp');
      expect(input.workflow_type).toBe('user_hair');
      expect(input.upscale).toBe(true);

      expect(result.imageUrl).toBe('https://images.example.com/swapped.webp');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
      expect(result.contentType).toBe('image/webp');
    });

    it('maps target hair preference to workflow_type', async () => {
      const provider = new FalFaceSwapProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, {
        images: [
          {
            url: 'https://images.example.com/swapped.webp',
            width: 512,
            height: 512,
            content_type: 'image/webp',
          },
        ],
      });

      await provider.swapFace({
        faceImageUrl: 'https://images.example.com/face.webp',
        targetImageUrl: 'https://images.example.com/target.webp',
        preserveHair: 'target',
        upscale: false,
      });

      const input = parseRequestBody(fetchMock);
      expect(input.workflow_type).toBe('target_hair');
      expect(input.upscale).toBe(false);
    });
  });
});
