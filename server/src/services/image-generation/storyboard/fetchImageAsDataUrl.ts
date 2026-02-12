import { logger } from '@infrastructure/Logger';

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Fetch an image from a URL and return it as a base64 data URL.
 *
 * Used to pass images inline to vision APIs that accept
 * data URLs in image_url.url fields.
 */
export async function fetchImageAsDataUrl(
  imageUrl: string,
  options?: { timeoutMs?: number; maxBytes?: number }
): Promise<string> {
  const log = logger.child({ service: 'fetchImageAsDataUrl' });
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image fetch failed: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? 'image/png';
    const mimeType = contentType.split(';')[0]?.trim() || 'image/png';

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > maxBytes) {
      throw new Error(
        `Image too large: ${buffer.byteLength} bytes exceeds ${maxBytes} byte limit`
      );
    }

    const base64 = Buffer.from(buffer).toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.warn('Failed to fetch image as data URL', {
      imageUrl: imageUrl.slice(0, 120),
      error: message,
    });
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
