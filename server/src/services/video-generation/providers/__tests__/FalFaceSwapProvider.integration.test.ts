import { describe, expect, it } from 'vitest';
import { FalFaceSwapProvider } from '../FalFaceSwapProvider';

describe('FalFaceSwapProvider (integration)', () => {
  const hasFalKey = Boolean(
    process.env.FAL_KEY ||
    process.env.FAL_API_KEY ||
    (process.env.FAL_KEY_ID && process.env.FAL_KEY_SECRET)
  );
  const shouldRun = process.env.RUN_FAL_INTEGRATION === 'true' && hasFalKey;
  const faceUrl = process.env.FACE_SWAP_TEST_FACE_URL;
  const targetUrl = process.env.FACE_SWAP_TEST_TARGET_URL;

  if (!shouldRun || !faceUrl || !targetUrl) {
    it.skip('requires RUN_FAL_INTEGRATION=true, FAL_KEY, FACE_SWAP_TEST_FACE_URL, FACE_SWAP_TEST_TARGET_URL', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it('swaps a face using fal.ai', async () => {
    const provider = new FalFaceSwapProvider();
    const result = await provider.swapFace({
      faceImageUrl: faceUrl,
      targetImageUrl: targetUrl,
    });

    expect(result.imageUrl).toMatch(/^https?:\/\//);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  }, 120000);
});
