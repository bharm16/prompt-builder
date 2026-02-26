import { logger } from '@infrastructure/Logger';
import type { VideoAssetStore } from './types';

const DEFAULT_RETENTION_HOURS = 24;
const DEFAULT_CLEANUP_INTERVAL_MINUTES = 15;
const DEFAULT_BATCH_SIZE = 100;

interface VideoAssetRetentionOptions {
  maxAgeMs: number;
  cleanupIntervalMs: number;
  batchSize: number;
}

export class VideoAssetRetentionService {
  private readonly assetStore: VideoAssetStore;
  private readonly maxAgeMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly batchSize: number;
  private readonly log = logger.child({ service: 'VideoAssetRetentionService' });
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(assetStore: VideoAssetStore, options: VideoAssetRetentionOptions) {
    this.assetStore = assetStore;
    this.maxAgeMs = options.maxAgeMs;
    this.cleanupIntervalMs = options.cleanupIntervalMs;
    this.batchSize = options.batchSize;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    if (this.maxAgeMs <= 0) {
      this.log.warn('Video asset retention disabled (maxAgeMs <= 0)');
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.cleanupIntervalMs);

    void this.runOnce();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async runOnce(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;
    try {
      const cutoffMs = Date.now() - this.maxAgeMs;
      const deleted = await this.assetStore.cleanupExpired(cutoffMs, this.batchSize);
      if (deleted > 0) {
        this.log.info('Expired video assets cleaned up', {
          deleted,
          cutoffMs,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Failed to cleanup expired video assets', {
        error: errorMessage,
      });
    } finally {
      this.running = false;
    }
  }
}

interface RetentionConfig {
  disabled: boolean;
  retentionHours: number;
  cleanupIntervalMinutes: number;
  batchSize: number;
}

export function createVideoAssetRetentionService(
  assetStore: VideoAssetStore,
  config: RetentionConfig
): VideoAssetRetentionService | null {
  if (config.disabled) {
    return null;
  }

  const maxAgeMs = config.retentionHours * 60 * 60 * 1000;
  const cleanupIntervalMs = config.cleanupIntervalMinutes * 60 * 1000;

  if (cleanupIntervalMs <= 0) {
    return null;
  }

  return new VideoAssetRetentionService(assetStore, {
    maxAgeMs,
    cleanupIntervalMs,
    batchSize: config.batchSize,
  });
}
