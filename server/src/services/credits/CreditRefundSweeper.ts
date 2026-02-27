import { logger } from '@infrastructure/Logger';
import type { UserCreditService } from './UserCreditService';
import type { RefundFailureStore } from './RefundFailureStore';

/** Narrow metrics interface — avoids importing the concrete MetricsService class. */
interface SweeperMetrics {
  recordAlert(name: string, labels: Record<string, unknown>): void;
}

const DEFAULT_SWEEP_INTERVAL_SECONDS = 60;
const DEFAULT_SWEEP_MAX = 25;
const DEFAULT_MAX_ATTEMPTS = 20;

interface CreditRefundSweeperOptions {
  sweepIntervalMs: number;
  maxSweepIntervalMs?: number;
  backoffFactor?: number;
  maxPerRun: number;
  maxAttempts: number;
}

export interface WorkerStatus {
  running: boolean;
  lastRunAt: Date | null;
  lastSuccessfulRunAt?: Date | null;
  consecutiveFailures: number;
}

export class CreditRefundSweeper {
  private readonly log = logger.child({ service: 'CreditRefundSweeper' });
  private readonly failureStore: RefundFailureStore;
  private readonly userCreditService: UserCreditService;
  private readonly baseSweepIntervalMs: number;
  private readonly maxSweepIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly maxPerRun: number;
  private readonly maxAttempts: number;
  private readonly metrics: SweeperMetrics | undefined;
  private timer: NodeJS.Timeout | null = null;
  private currentSweepIntervalMs = 0;
  private started = false;
  private running = false;
  private lastRunAt: Date | null = null;
  private lastSuccessfulRunAt: Date | null = null;
  private consecutiveFailures = 0;

  constructor(
    failureStore: RefundFailureStore,
    userCreditService: UserCreditService,
    options: CreditRefundSweeperOptions,
    metricsService?: SweeperMetrics,
  ) {
    this.failureStore = failureStore;
    this.userCreditService = userCreditService;
    this.baseSweepIntervalMs = options.sweepIntervalMs;
    this.maxSweepIntervalMs = options.maxSweepIntervalMs ?? Math.max(this.baseSweepIntervalMs * 8, 120_000);
    this.backoffFactor = options.backoffFactor ?? 2;
    this.maxPerRun = options.maxPerRun;
    this.maxAttempts = options.maxAttempts;
    this.metrics = metricsService;
    this.currentSweepIntervalMs = this.baseSweepIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.currentSweepIntervalMs = this.baseSweepIntervalMs;
    this.scheduleNext(0);
  }

  private scheduleNext(delayMs: number): void {
    if (!this.started) {
      return;
    }
    this.timer = setTimeout(() => {
      void this.runLoop();
    }, delayMs);
  }

  private async runLoop(): Promise<void> {
    if (!this.started) {
      return;
    }
    try {
      const success = await this.runOnce();
      if (success) {
        this.currentSweepIntervalMs = this.baseSweepIntervalMs;
      } else {
        this.currentSweepIntervalMs = Math.min(
          this.maxSweepIntervalMs,
          Math.round(this.currentSweepIntervalMs * this.backoffFactor)
        );
      }
    } catch (error) {
      this.consecutiveFailures += 1;
      this.log.error('Worker loop failed unexpectedly', error as Error);
      this.metrics?.recordAlert('worker_loop_crash', { worker: 'CreditRefundSweeper' });
      this.currentSweepIntervalMs = Math.min(
        this.maxSweepIntervalMs,
        Math.round(this.currentSweepIntervalMs * this.backoffFactor)
      );
    }
    if (this.started) {
      this.scheduleNext(this.currentSweepIntervalMs);
    }
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getStatus(): WorkerStatus {
    return {
      running: this.started,
      lastRunAt: this.lastRunAt,
      lastSuccessfulRunAt: this.lastSuccessfulRunAt,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }
    this.running = true;

    try {
      let processed = 0;

      while (processed < this.maxPerRun) {
        const next = await this.failureStore.claimNextPending(this.maxAttempts, this.maxPerRun);
        if (!next) {
          break;
        }

        const ok = await this.userCreditService.refundCredits(next.userId, next.amount, {
          refundKey: next.refundKey,
          ...(next.reason ? { reason: next.reason } : {}),
        });

        if (ok) {
          await this.failureStore.markResolved(next.refundKey);
          this.log.info('Recovered queued credit refund', {
            refundKey: next.refundKey,
            userId: next.userId,
            amount: next.amount,
            attempts: next.attempts + 1,
          });
        } else {
          const nextAttempts = next.attempts + 1;
          const errorMessage = 'Background refund retry failed';

          if (nextAttempts >= this.maxAttempts) {
            await this.failureStore.markEscalated(next.refundKey, errorMessage);
            this.log.error('Credit refund escalated after max attempts', undefined, {
              refundKey: next.refundKey,
              userId: next.userId,
              amount: next.amount,
              attempts: nextAttempts,
              severity: 'critical',
            });
            this.metrics?.recordAlert('credit_refund_escalated', {
              refundKey: next.refundKey,
              userId: next.userId,
              amount: next.amount,
              attempts: nextAttempts,
            });
          } else {
            await this.failureStore.releaseForRetry(next.refundKey, errorMessage);
          }
        }

        processed += 1;
      }
      const now = new Date();
      this.lastRunAt = now;
      this.lastSuccessfulRunAt = now;
      this.consecutiveFailures = 0;
      return true;
    } catch (error) {
      this.lastRunAt = new Date();
      this.consecutiveFailures += 1;
      this.log.error('Credit refund sweeper run failed', error as Error);
      return false;
    } finally {
      this.running = false;
    }
  }
}

interface RefundSweeperConfig {
  disabled: boolean;
  intervalSeconds: number;
  maxPerRun: number;
  maxAttempts: number;
}

export function createCreditRefundSweeper(
  failureStore: RefundFailureStore,
  userCreditService: UserCreditService,
  metricsService: SweeperMetrics | undefined,
  config: RefundSweeperConfig,
): CreditRefundSweeper | null {
  if (config.disabled) {
    return null;
  }

  const sweepIntervalMs = config.intervalSeconds * 1000;
  if (sweepIntervalMs <= 0 || config.maxPerRun <= 0 || config.maxAttempts <= 0) {
    return null;
  }

  return new CreditRefundSweeper(failureStore, userCreditService, {
    sweepIntervalMs,
    maxSweepIntervalMs: sweepIntervalMs * 8,
    backoffFactor: 2,
    maxPerRun: config.maxPerRun,
    maxAttempts: config.maxAttempts,
  }, metricsService);
}
