import { logger } from '@infrastructure/Logger';
import type { WorkerStatus } from '@services/credits/CreditRefundSweeper';
import type { BillingProfileStore } from './BillingProfileStore';
import type { PaymentConsistencyStore } from './PaymentConsistencyStore';

interface BillingProfileRepairWorkerOptions {
  pollIntervalMs: number;
  maxPerRun: number;
  maxAttempts: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

export class BillingProfileRepairWorker {
  private readonly log = logger.child({ service: 'BillingProfileRepairWorker' });
  private readonly consistencyStore: PaymentConsistencyStore;
  private readonly billingProfileStore: BillingProfileStore;
  private readonly basePollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly maxPerRun: number;
  private readonly maxAttempts: number;
  private readonly metrics: BillingProfileRepairWorkerOptions['metrics'];
  private timer: NodeJS.Timeout | null = null;
  private currentPollIntervalMs = 0;
  private started = false;
  private running = false;
  private lastRunAt: Date | null = null;
  private lastSuccessfulRunAt: Date | null = null;
  private consecutiveFailures = 0;

  constructor(
    consistencyStore: PaymentConsistencyStore,
    billingProfileStore: BillingProfileStore,
    options: BillingProfileRepairWorkerOptions
  ) {
    this.consistencyStore = consistencyStore;
    this.billingProfileStore = billingProfileStore;
    this.basePollIntervalMs = options.pollIntervalMs;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? Math.max(this.basePollIntervalMs * 8, 120_000);
    this.backoffFactor = options.backoffFactor ?? 2;
    this.maxPerRun = options.maxPerRun;
    this.maxAttempts = options.maxAttempts;
    this.metrics = options.metrics;
    this.currentPollIntervalMs = this.basePollIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.currentPollIntervalMs = this.basePollIntervalMs;
    this.scheduleNext(0);
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
        this.currentPollIntervalMs = this.basePollIntervalMs;
      } else {
        this.currentPollIntervalMs = Math.min(
          this.maxPollIntervalMs,
          Math.round(this.currentPollIntervalMs * this.backoffFactor)
        );
      }
    } catch (error) {
      this.consecutiveFailures += 1;
      this.log.error('Worker loop failed unexpectedly', error as Error);
      this.metrics?.recordAlert('worker_loop_crash', { worker: 'BillingProfileRepairWorker' });
      this.currentPollIntervalMs = Math.min(
        this.maxPollIntervalMs,
        Math.round(this.currentPollIntervalMs * this.backoffFactor)
      );
    }
    if (this.started) {
      this.scheduleNext(this.currentPollIntervalMs);
    }
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }
    this.running = true;

    try {
      let processed = 0;

      while (processed < this.maxPerRun) {
        const task = await this.consistencyStore.claimNextBillingProfileRepair(
          this.maxAttempts,
          this.maxPerRun
        );
        if (!task) {
          break;
        }

        try {
          await this.billingProfileStore.upsertProfile(task.userId, {
            stripeCustomerId: task.stripeCustomerId,
            ...(task.stripeSubscriptionId ? { stripeSubscriptionId: task.stripeSubscriptionId } : {}),
            ...(task.planTier ? { planTier: task.planTier } : {}),
            ...(task.subscriptionPriceId ? { subscriptionPriceId: task.subscriptionPriceId } : {}),
            stripeLivemode: task.stripeLivemode,
          });
          await this.consistencyStore.markBillingProfileRepairResolved(task.repairKey);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const nextAttempts = task.attempts + 1;
          if (nextAttempts >= this.maxAttempts) {
            await this.consistencyStore.markBillingProfileRepairEscalated(task.repairKey, errorMessage);
            this.metrics?.recordAlert('billing_profile_repair_escalated', {
              repairKey: task.repairKey,
              userId: task.userId,
              source: task.source,
              referenceId: task.referenceId,
              attempts: nextAttempts,
            });
          } else {
            await this.consistencyStore.releaseBillingProfileRepairForRetry(task.repairKey, errorMessage);
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
      this.log.error('Billing profile repair worker run failed', error as Error);
      return false;
    } finally {
      this.running = false;
    }
  }
}

interface BillingProfileRepairConfig {
  disabled: boolean;
  intervalSeconds: number;
  maxPerRun: number;
  maxAttempts: number;
}

export function createBillingProfileRepairWorker(
  consistencyStore: PaymentConsistencyStore,
  billingProfileStore: BillingProfileStore,
  metrics: { recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void } | undefined,
  config: BillingProfileRepairConfig
): BillingProfileRepairWorker | null {
  if (config.disabled) {
    return null;
  }

  const pollIntervalMs = config.intervalSeconds * 1000;
  if (pollIntervalMs <= 0 || config.maxPerRun <= 0 || config.maxAttempts <= 0) {
    return null;
  }

  return new BillingProfileRepairWorker(consistencyStore, billingProfileStore, {
    pollIntervalMs,
    maxPerRun: config.maxPerRun,
    maxAttempts: config.maxAttempts,
    ...(metrics ? { metrics } : {}),
  });
}
