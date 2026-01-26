import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { FalPulidKeyframeProvider } from '../FalPulidKeyframeProvider';

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

describe('FalPulidKeyframeProvider', () => {
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
    it('throws when the provider is not configured', async () => {
      clearFalEnv();
      const provider = new FalPulidKeyframeProvider();

      await expect(
        provider.generateKeyframe({
          prompt: 'Test prompt',
          faceImageUrl: 'https://images.example.com/face.webp',
        })
      ).rejects.toThrow('Fal.ai provider is not configured. Set FAL_KEY or FAL_API_KEY.');
    });

    it('throws when the face image URL is missing', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });

      await expect(
        provider.generateKeyframe({
          prompt: 'Test prompt',
          faceImageUrl: '',
        })
      ).rejects.toThrow('Face reference image URL is required');
    });

    it('wraps failed queue responses with the returned error message', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });

      fetchMock
        .mockResolvedValueOnce(
          buildJsonResponse({
            request_id: 'req-2',
            status_url: 'https://queue.fal.run/status/req-2',
            response_url: 'https://queue.fal.run/response/req-2',
          })
        )
        .mockResolvedValueOnce(
          buildJsonResponse({
            status: 'FAILED',
            error: { message: 'No credits available' },
          })
        );

      await expect(
        provider.generateKeyframe({
          prompt: 'Test prompt',
          faceImageUrl: 'https://images.example.com/face.webp',
        })
      ).rejects.toThrow('Fal generation failed: No credits available');
    });

    it('throws when the response contains no output image', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, { seed: 12 });

      await expect(
        provider.generateKeyframe({
          prompt: 'Test prompt',
          faceImageUrl: 'https://images.example.com/face.webp',
        })
      ).rejects.toThrow('PuLID generation returned no output image');
    });
  });

  describe('edge cases', () => {
    it('adds quality terms and default parameters when missing', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, {
        images: [{ url: 'https://images.example.com/keyframe.webp' }],
        seed: 7,
      });

      const options = {
        prompt: 'A portrait of a scientist',
        faceImageUrl: 'https://images.example.com/face.webp',
      };

      await provider.generateKeyframe(options);

      const input = parseRequestBody(fetchMock);
      expect(input.prompt).toContain(options.prompt);
      expect(input.prompt).toContain('high quality');
      expect(input.prompt).toContain('professional lighting');
      expect(input.reference_images).toEqual([options.faceImageUrl]);
      expect(input.id_weight).toBe(0.8);
      expect(input.width).toBe(1344);
      expect(input.height).toBe(768);
      expect(input.num_inference_steps).toBe(28);
      expect(input.guidance_scale).toBe(7.5);
      expect(input.negative_prompt).toContain('blurry');
      expect('seed' in input).toBe(false);
    });

    it('uses the single image response when no images array is provided', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, {
        image: { url: 'https://images.example.com/fallback.webp' },
        seed: 22,
      });

      const result = await provider.generateKeyframe({
        prompt: 'Test prompt',
        faceImageUrl: 'https://images.example.com/face.webp',
      });

      expect(result.imageUrl).toBe('https://images.example.com/fallback.webp');
    });
  });

  describe('core behavior', () => {
    it('returns a keyframe result with input-derived fields and response seed', async () => {
      const provider = new FalPulidKeyframeProvider({ apiKey: 'fal-key' });
      mockQueueSuccess(fetchMock, {
        images: [{ url: 'https://images.example.com/output.webp' }],
        seed: 123,
      });

      const options = {
        prompt: 'Portrait 4k',
        faceImageUrl: 'https://images.example.com/face.webp',
        aspectRatio: '9:16' as const,
        idWeight: 0.55,
        seed: 99,
      };

      const result = await provider.generateKeyframe(options);
      const input = parseRequestBody(fetchMock);

      expect(input.prompt).toBe(options.prompt);
      expect(input.width).toBe(768);
      expect(input.height).toBe(1344);
      expect(result.imageUrl).toBe('https://images.example.com/output.webp');
      expect(result.model).toBe('fal-ai/flux-pulid');
      expect(result.aspectRatio).toBe(options.aspectRatio);
      expect(result.idWeight).toBe(options.idWeight);
      expect(result.prompt).toBe(options.prompt);
      expect(result.seed).toBe(123);
    });
  });
});
