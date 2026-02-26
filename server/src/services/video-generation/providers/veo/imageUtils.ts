export interface VeoInlineData {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export async function fetchAsVeoInline(
  url: string,
  kind: 'image' | 'video' = 'image'
): Promise<VeoInlineData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${kind} from ${url}: HTTP ${response.status}`);
  }

  const contentType = ((response.headers.get('content-type') || '').split(';')[0] || '')
    .trim()
    .toLowerCase();
  const allowedTypes = kind === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_VIDEO_TYPES;
  const fallbackType = kind === 'image' ? 'image/png' : 'video/mp4';
  const mimeType = allowedTypes.has(contentType) ? contentType : fallbackType;

  const maxBytes = kind === 'image' ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > maxBytes) {
    throw new Error(
      `${kind} at ${url} is ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB, exceeds ${
        maxBytes / 1024 / 1024
      }MB limit`
    );
  }

  return {
    inlineData: {
      mimeType,
      data: Buffer.from(buffer).toString('base64'),
    },
  };
}
