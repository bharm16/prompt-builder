/**
 * SessionCleanupSweeper - Periodic cleanup of expired convergence sessions
 *
 * Runs on a configurable interval to mark sessions inactive for 24+ hours
 * as abandoned. Follows the VideoJobSweeper pattern for consistency.
 *
 * Requirements:
 * - 1.4: Sessions inactive for 24 hours are marked as abandoned during cleanup
 */

import { logger } from '@infrastructure/Logger';
import type { SessionStore } from './SessionStore';

const DEFAULT_CLEANUP_INTERVAL_HOURS = 1;

interface SessionCleanupSweeperOptions {
  cleanupIntervalMs: number;
}

export class SessionCleanupSweeper {
  private readonly sessionStore: SessionStore;
  private readonly cleanupIntervalMs: number;
  private readonly log = logger.child({ service: 'SessionCleanupSweeper' });
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(sessionStore: SessionStore, options: SessionCleanupSweeperOptions) {
    this.sessionStore = sessionStore;
    this.cleanupIntervalMs = options.cleanupIntervalMs;
  }

  /**
   * Start the periodic cleanup timer
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.log.info('Starting session cleanup sweeper', {
      cleanupIntervalMs: this.cleanupIntervalMs,
    });

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.cleanupIntervalMs);

    // Run immediately on start
    void this.runOnce();
  }

  /**
   * Stop the periodic cleanup timer
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.log.info('Stopped session cleanup sweeper');
    }
  }

  /**
   * Run a single cleanup cycle
   */
  async runOnce(): Promise<number> {
    if (this.running) {
      this.log.debug('Cleanup already in progress, skipping');
      return 0;
    }

    this.running = true;
    const startTime = Date.now();

    try {
      // Use the existing cleanupExpired method from SessionStore
      const cleanedCount = await this.sessionStore.cleanupExpired();

      const duration = Date.now() - startTime;

      if (cleanedCount > 0) {
        this.log.info('Expired convergence sessions cleaned up', {
          count: cleanedCount,
          duration,
        });
      } else {
        this.log.debug('No expired sessions to clean up', { duration });
      }

      return cleanedCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Failed to sweep expired sessions', { error: errorMessage });
      return 0;
    } finally {
      this.running = false;
    }
  }
}

/**
 * Factory function to create the session cleanup sweeper
 * Returns null if disabled via environment variable
 */
export function createSessionCleanupSweeper(
  sessionStore: SessionStore
): SessionCleanupSweeper | null {
  const disabled = process.env.CONVERGENCE_SESSION_SWEEPER_DISABLED === 'true';
  if (disabled) {
    logger.info('Session cleanup sweeper disabled via environment');
    return null;
  }

  const cleanupIntervalHours = Number.parseFloat(
    process.env.CONVERGENCE_SESSION_CLEANUP_INTERVAL_HOURS ||
      String(DEFAULT_CLEANUP_INTERVAL_HOURS)
  );

  const cleanupIntervalMs = Number.isFinite(cleanupIntervalHours)
    ? cleanupIntervalHours * 60 * 60 * 1000
    : DEFAULT_CLEANUP_INTERVAL_HOURS * 60 * 60 * 1000;

  if (cleanupIntervalMs <= 0) {
    logger.warn('Invalid session cleanup configuration, sweeper disabled');
    return null;
  }

  return new SessionCleanupSweeper(sessionStore, {
    cleanupIntervalMs,
  });
}
