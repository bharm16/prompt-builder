import { logger } from '@infrastructure/Logger';
import type { CreditReconciliationService, ReconciliationRunResult } from './CreditReconciliationService';

const DEFAULT_INCREMENTAL_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_FULL_PASS_INTERVAL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_BACKOFF_FACTOR = 2;

interface CreditReconciliationWorkerOptions {
  incrementalIntervalMs: number;
  fullPassIntervalMs: number;
  maxIntervalMs?: number;
  backoffFactor?: number;
  metrics?: {
    recordAlert?: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

export class CreditReconciliationWorker {
  private readonly log = logger.child({ service: 'CreditReconciliationWorker' });
  private readonly incrementalIntervalMs: number;
  private readonly fullPassIntervalMs: number;
  private readonly maxIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly metrics: CreditReconciliationWorkerOptions['metrics'];
  private timer: NodeJS.Timeout | null = null;
  private currentIntervalMs = 0;
  private running = false;
  private started = false;
  private nextFullPassAtMs = 0;

  constructor(
    private readonly reconciliationService: CreditReconciliationService,
    options: CreditReconciliationWorkerOptions
  ) {
    this.incrementalIntervalMs = options.incrementalIntervalMs;
    this.fullPassIntervalMs = options.fullPassIntervalMs;
    this.maxIntervalMs = options.maxIntervalMs ?? Math.max(this.incrementalIntervalMs * 6, DEFAULT_MAX_INTERVAL_MS);
    this.backoffFactor = options.backoffFactor ?? DEFAULT_BACKOFF_FACTOR;
    this.metrics = options.metrics;
    this.currentIntervalMs = this.incrementalIntervalMs;
    this.nextFullPassAtMs = Date.now() + this.fullPassIntervalMs;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.currentIntervalMs = this.incrementalIntervalMs;
    this.nextFullPassAtMs = Date.now() + this.fullPassIntervalMs;
    this.scheduleNext(0);
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
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
      const ok = await this.runOnce();
      if (ok) {
        this.currentIntervalMs = this.incrementalIntervalMs;
      } else {
        this.currentIntervalMs = Math.min(
          this.maxIntervalMs,
          Math.round(this.currentIntervalMs * this.backoffFactor)
        );
      }
    } catch (error) {
      this.log.error('Worker loop failed unexpectedly', error as Error);
      this.metrics?.recordAlert?.('worker_loop_crash', { worker: 'CreditReconciliationWorker' });
      this.currentIntervalMs = Math.min(
        this.maxIntervalMs,
        Math.round(this.currentIntervalMs * this.backoffFactor)
      );
    }
    if (this.started) {
      this.scheduleNext(this.currentIntervalMs);
    }
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) {
      return true;
    }

    this.running = true;
    try {
      const incrementalResult = await this.reconciliationService.runIncrementalPass();
      this.logRunResult(incrementalResult);

      if (Date.now() >= this.nextFullPassAtMs) {
        const fullPassResult = await this.reconciliationService.runFullPass();
        this.logRunResult(fullPassResult);
        this.nextFullPassAtMs = Date.now() + this.fullPassIntervalMs;
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.error('Credit reconciliation worker run failed', error as Error, {
        error: errorMessage,
      });
      this.metrics?.recordAlert?.('credit_reconciliation_worker_failure', { error: errorMessage });
      return false;
    } finally {
      this.running = false;
    }
  }

  private logRunResult(result: ReconciliationRunResult): void {
    if (
      result.processedUsers === 0 &&
      result.positiveCorrections === 0 &&
      result.queuedNegativeCorrections === 0 &&
      result.scannedItems === 0
    ) {
      this.log.debug('Credit reconciliation run completed with no work', { scope: result.scope });
      return;
    }

    this.log.info('Credit reconciliation run completed', {
      scope: result.scope,
      scannedItems: result.scannedItems,
      processedUsers: result.processedUsers,
      positiveCorrections: result.positiveCorrections,
      queuedNegativeCorrections: result.queuedNegativeCorrections,
      checkpointUpdated: result.checkpointUpdated,
    });
  }
}

interface ReconciliationConfig {
  disabled: boolean;
  incrementalIntervalSeconds: number;
  fullIntervalHours: number;
  maxIntervalSeconds: number;
  backoffFactor: number;
}

export function createCreditReconciliationWorker(
  reconciliationService: CreditReconciliationService,
  metrics: {
    recordAlert?: (alertName: string, metadata?: Record<string, unknown>) => void;
  } | undefined,
  config: ReconciliationConfig,
): CreditReconciliationWorker | null {
  if (config.disabled) {
    return null;
  }

  return new CreditReconciliationWorker(reconciliationService, {
    incrementalIntervalMs: config.incrementalIntervalSeconds * 1000,
    fullPassIntervalMs: config.fullIntervalHours * 60 * 60 * 1000,
    maxIntervalMs: config.maxIntervalSeconds * 1000,
    backoffFactor: config.backoffFactor,
    ...(metrics ? { metrics } : {}),
  });
}
