import NodeCache from 'node-cache';
import { v4 as uuidv4 } from 'uuid';
import type { StoredVideoContent } from './types';

const DEFAULT_CONTENT_TTL_SECONDS = 60 * 10;

export class VideoContentStore {
  private readonly cache: NodeCache;

  constructor(ttlSeconds: number = DEFAULT_CONTENT_TTL_SECONDS) {
    this.cache = new NodeCache({
      stdTTL: ttlSeconds,
      checkperiod: 120,
      useClones: false,
    });
  }

  store(buffer: Buffer, contentType: string): string {
    const id = uuidv4();
    const entry: StoredVideoContent = {
      buffer,
      contentType,
      createdAt: Date.now(),
    };
    this.cache.set(id, entry);
    return id;
  }

  get(id: string): StoredVideoContent | null {
    const entry = this.cache.get<StoredVideoContent>(id);
    return entry ?? null;
  }

  buildContentUrl(id: string): string {
    return `/api/preview/video/content/${id}`;
  }
}
