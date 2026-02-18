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
  maxPerRun: number;
  maxAttempts: number;
}

export class CreditRefundSweeper {
  private readonly log = logger.child({ service: 'CreditRefundSweeper' });
  private readonly failureStore: RefundFailureStore;
  private readonly userCreditService: UserCreditService;
  private readonly sweepIntervalMs: number;
  private readonly maxPerRun: number;
  private readonly maxAttempts: number;
  private readonly metrics: SweeperMetrics | undefined;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    failureStore: RefundFailureStore,
    userCreditService: UserCreditService,
    options: CreditRefundSweeperOptions,
    metricsService?: SweeperMetrics,
  ) {
    this.failureStore = failureStore;
    this.userCreditService = userCreditService;
    this.sweepIntervalMs = options.sweepIntervalMs;
    this.maxPerRun = options.maxPerRun;
    this.maxAttempts = options.maxAttempts;
    this.metrics = metricsService;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runOnce();
    }, this.sweepIntervalMs);

    void this.runOnce();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }

  private async runOnce(): Promise<void> {
    if (this.running) {
      return;
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
    } catch (error) {
      this.log.error('Credit refund sweeper run failed', error as Error);
    } finally {
      this.running = false;
    }
  }
}

export function createCreditRefundSweeper(
  failureStore: RefundFailureStore,
  userCreditService: UserCreditService,
  metricsService?: SweeperMetrics,
): CreditRefundSweeper | null {
  if (process.env.CREDIT_REFUND_SWEEPER_DISABLED === 'true') {
    return null;
  }

  const sweepIntervalSeconds = Number.parseInt(
    process.env.CREDIT_REFUND_SWEEP_INTERVAL_SECONDS || String(DEFAULT_SWEEP_INTERVAL_SECONDS),
    10
  );
  const sweepMax = Number.parseInt(
    process.env.CREDIT_REFUND_SWEEP_MAX || String(DEFAULT_SWEEP_MAX),
    10
  );
  const maxAttempts = Number.parseInt(
    process.env.CREDIT_REFUND_MAX_ATTEMPTS || String(DEFAULT_MAX_ATTEMPTS),
    10
  );

  const sweepIntervalMs = Number.isFinite(sweepIntervalSeconds) ? sweepIntervalSeconds * 1000 : 0;
  if (sweepIntervalMs <= 0 || sweepMax <= 0 || maxAttempts <= 0) {
    return null;
  }

  return new CreditRefundSweeper(failureStore, userCreditService, {
    sweepIntervalMs,
    maxPerRun: sweepMax,
    maxAttempts,
  }, metricsService);
}
