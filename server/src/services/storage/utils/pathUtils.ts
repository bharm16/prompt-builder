import crypto from 'node:crypto';
import type { StorageType } from '../config/storageConfig';

const DEFAULT_EXTENSIONS: Record<StorageType, string> = {
  'preview-image': 'webp',
  'preview-video': 'mp4',
  generation: 'mp4',
};

const TYPE_SEGMENTS: Record<StorageType, string> = {
  'preview-image': 'previews/images',
  'preview-video': 'previews/videos',
  generation: 'generations',
};

export function generateStoragePath(userId: string, type: StorageType, extension?: string | null): string {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const resolvedExtension = (extension || DEFAULT_EXTENSIONS[type] || 'mp4').replace(/^\.+/, '');
  return `users/${userId}/${TYPE_SEGMENTS[type]}/${timestamp}-${hash}.${resolvedExtension}`;
}

export function extractUserIdFromPath(path: string): string | null {
  const match = path.match(/^users\/([^/]+)\//);
  return match ? match[1] : null;
}

export function validatePathOwnership(path: string, userId: string): boolean {
  return extractUserIdFromPath(path) === userId;
}

export function getTypeFromPath(path: string): StorageType | null {
  if (path.includes('/previews/images/')) return 'preview-image';
  if (path.includes('/previews/videos/')) return 'preview-video';
  if (path.includes('/generations/')) return 'generation';
  return null;
}
