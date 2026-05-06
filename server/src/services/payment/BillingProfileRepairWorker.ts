import type { BillingProfileStore } from "./BillingProfileStore";
import type { PaymentConsistencyStore } from "./PaymentConsistencyStore";
import {
  PollingWorkerBase,
  type PollingWorkerMetrics,
} from "@services/polling/PollingWorkerBase";

interface BillingProfileRepairWorkerOptions {
  pollIntervalMs: number;
  maxPerRun: number;
  maxAttempts: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  metrics?: PollingWorkerMetrics;
}

export class BillingProfileRepairWorker extends PollingWorkerBase {
  private readonly consistencyStore: PaymentConsistencyStore;
  private readonly billingProfileStore: BillingProfileStore;
  private readonly maxPerRun: number;
  private readonly maxAttempts: number;
  private readonly repairMetrics: PollingWorkerMetrics | undefined;
  private running = false;

  constructor(
    consistencyStore: PaymentConsistencyStore,
    billingProfileStore: BillingProfileStore,
    options: BillingProfileRepairWorkerOptions,
  ) {
    super({
      workerId: "BillingProfileRepairWorker",
      basePollIntervalMs: options.pollIntervalMs,
      maxPollIntervalMs:
        options.maxPollIntervalMs ??
        Math.max(options.pollIntervalMs * 8, 120_000),
      ...(options.backoffFactor !== undefined
        ? { backoffFactor: options.backoffFactor }
        : {}),
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    this.consistencyStore = consistencyStore;
    this.billingProfileStore = billingProfileStore;
    this.maxPerRun = options.maxPerRun;
    this.maxAttempts = options.maxAttempts;
    this.repairMetrics = options.metrics;
  }

  protected async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }
    this.running = true;

    try {
      let processed = 0;

      while (processed < this.maxPerRun) {
        const task = await this.consistencyStore.claimNextBillingProfileRepair(
          this.maxAttempts,
          this.maxPerRun,
        );
        if (!task) {
          break;
        }

        try {
          await this.billingProfileStore.upsertProfile(task.userId, {
            stripeCustomerId: task.stripeCustomerId,
            ...(task.stripeSubscriptionId
              ? { stripeSubscriptionId: task.stripeSubscriptionId }
              : {}),
            ...(task.planTier ? { planTier: task.planTier } : {}),
            ...(task.subscriptionPriceId
              ? { subscriptionPriceId: task.subscriptionPriceId }
              : {}),
            stripeLivemode: task.stripeLivemode,
          });
          await this.consistencyStore.markBillingProfileRepairResolved(
            task.repairKey,
          );
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const nextAttempts = task.attempts + 1;
          if (nextAttempts >= this.maxAttempts) {
            await this.consistencyStore.markBillingProfileRepairEscalated(
              task.repairKey,
              errorMessage,
            );
            this.repairMetrics?.recordAlert(
              "billing_profile_repair_escalated",
              {
                repairKey: task.repairKey,
                userId: task.userId,
                source: task.source,
                referenceId: task.referenceId,
                attempts: nextAttempts,
              },
            );
          } else {
            await this.consistencyStore.releaseBillingProfileRepairForRetry(
              task.repairKey,
              errorMessage,
            );
          }
        }

        processed += 1;
      }

      this.markRunSuccess();
      return true;
    } catch (error) {
      this.markRunFailure();
      this.log.error(
        "Billing profile repair worker run failed",
        error as Error,
      );
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
  metrics: PollingWorkerMetrics | undefined,
  config: BillingProfileRepairConfig,
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
