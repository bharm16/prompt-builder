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

export function createVideoAssetRetentionService(assetStore: VideoAssetStore): VideoAssetRetentionService | null {
  const disabled = process.env.VIDEO_ASSET_RETENTION_DISABLED === 'true';
  if (disabled) {
    return null;
  }

  const retentionHours = Number.parseInt(
    process.env.VIDEO_ASSET_RETENTION_HOURS || String(DEFAULT_RETENTION_HOURS),
    10
  );
  const intervalMinutes = Number.parseInt(
    process.env.VIDEO_ASSET_CLEANUP_INTERVAL_MINUTES || String(DEFAULT_CLEANUP_INTERVAL_MINUTES),
    10
  );
  const batchSize = Number.parseInt(
    process.env.VIDEO_ASSET_CLEANUP_BATCH_SIZE || String(DEFAULT_BATCH_SIZE),
    10
  );

  const maxAgeMs = Number.isFinite(retentionHours) ? retentionHours * 60 * 60 * 1000 : 0;
  const cleanupIntervalMs = Number.isFinite(intervalMinutes) ? intervalMinutes * 60 * 1000 : 0;
  const safeBatchSize = Number.isFinite(batchSize) ? batchSize : DEFAULT_BATCH_SIZE;

  if (cleanupIntervalMs <= 0) {
    return null;
  }

  return new VideoAssetRetentionService(assetStore, {
    maxAgeMs,
    cleanupIntervalMs,
    batchSize: safeBatchSize,
  });
}
