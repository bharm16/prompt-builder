import { fileTypeFromBuffer } from 'file-type';

const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

export async function validateImageBuffer(
  buffer: Buffer,
  fieldName: string
): Promise<string> {
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.mime)) {
    throw new Error(
      `Invalid file type for ${fieldName}: expected image, got ${detected?.mime ?? 'unknown'}`
    );
  }
  return detected.mime;
}
