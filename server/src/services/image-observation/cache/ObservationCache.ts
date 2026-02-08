/**
 * ObservationCache - Simple cache for image observations
 *
 * PATTERN: Repository
 */

import { cacheService } from '@services/cache/CacheService';
import type { ImageObservation } from '../types';

const NAMESPACE = 'image-observation';
const TTL_SECONDS = 86400;

export class ObservationCache {
  private readonly memory = new Map<string, { data: ImageObservation; expires: number }>();

  async get(imageHash: string): Promise<ImageObservation | null> {
    const mem = this.memory.get(imageHash);
    if (mem && mem.expires > Date.now()) {
      return mem.data;
    }

    try {
      const cached = await cacheService.get<ImageObservation>(`${NAMESPACE}:${imageHash}`);
      if (cached) {
        this.memory.set(imageHash, { data: cached, expires: Date.now() + TTL_SECONDS * 1000 });
        return cached;
      }
    } catch {
      // Redis unavailable, continue
    }

    return null;
  }

  async set(imageHash: string, observation: ImageObservation): Promise<void> {
    this.memory.set(imageHash, { data: observation, expires: Date.now() + TTL_SECONDS * 1000 });
    try {
      await cacheService.set(`${NAMESPACE}:${imageHash}`, observation, { ttl: TTL_SECONDS });
    } catch {
      // Redis unavailable, memory-only
    }
  }
}
