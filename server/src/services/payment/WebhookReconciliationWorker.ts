import { logger } from '@infrastructure/Logger';
import type { WorkerStatus } from '@services/credits/CreditRefundSweeper';
import type { PaymentService } from './PaymentService';
import type { StripeWebhookEventStore } from './StripeWebhookEventStore';
import { createWebhookEventHandlers, type WebhookEventHandlers } from '@routes/payment/webhook/handlers';
import type { BillingProfileStore } from './BillingProfileStore';
import type { UserCreditService } from '@services/credits/UserCreditService';

const DEFAULT_LOOKBACK_HOURS = 72;

interface WebhookReconciliationWorkerOptions {
  pollIntervalMs: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  lookbackHours?: number;
  metrics?: {
    recordAlert: (alertName: string, metadata?: Record<string, unknown>) => void;
  };
}

export class WebhookReconciliationWorker {
  private readonly log = logger.child({ service: 'WebhookReconciliationWorker' });
  private readonly paymentService: PaymentService;
  private readonly webhookEventStore: StripeWebhookEventStore;
  private readonly handlers: WebhookEventHandlers;
  private readonly basePollIntervalMs: number;
  private readonly maxPollIntervalMs: number;
  private readonly backoffFactor: number;
  private readonly lookbackHours: number;
  private readonly metrics?: WebhookReconciliationWorkerOptions['metrics'];
  private timer: NodeJS.Timeout | null = null;
  private currentPollIntervalMs: number;
  private started = false;
  private running = false;
  private lastRunAt: Date | null = null;
  private consecutiveFailures = 0;

  constructor(
    paymentService: PaymentService,
    webhookEventStore: StripeWebhookEventStore,
    billingProfileStore: BillingProfileStore,
    userCreditService: UserCreditService,
    options: WebhookReconciliationWorkerOptions
  ) {
    this.paymentService = paymentService;
    this.webhookEventStore = webhookEventStore;
    this.basePollIntervalMs = options.pollIntervalMs;
    this.maxPollIntervalMs = options.maxPollIntervalMs ?? Math.max(this.basePollIntervalMs * 4, 600_000);
    this.backoffFactor = options.backoffFactor ?? 2;
    this.lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
    this.metrics = options.metrics;

    this.handlers = createWebhookEventHandlers({
      paymentService,
      billingProfileStore,
      userCreditService,
    });

    this.currentPollIntervalMs = this.basePollIntervalMs;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.currentPollIntervalMs = this.basePollIntervalMs;
    this.log.info('Webhook reconciliation worker started', {
      pollIntervalMs: this.basePollIntervalMs,
      lookbackHours: this.lookbackHours,
    });
    this.scheduleNext(this.basePollIntervalMs);
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
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private scheduleNext(delayMs: number): void {
    if (!this.started) return;
    this.timer = setTimeout(() => {
      void this.runLoop();
    }, delayMs);
  }

  private async runLoop(): Promise<void> {
    if (!this.started) return;
    const success = await this.runOnce();
    if (success) {
      this.currentPollIntervalMs = this.basePollIntervalMs;
    } else {
      this.currentPollIntervalMs = Math.min(
        this.maxPollIntervalMs,
        Math.round(this.currentPollIntervalMs * this.backoffFactor)
      );
    }
    this.scheduleNext(this.currentPollIntervalMs);
  }

  private async runOnce(): Promise<boolean> {
    if (this.running) return true;
    this.running = true;

    let reconciled = 0;
    let skipped = 0;

    try {
      const lookbackSeconds = this.lookbackHours * 3600;
      const createdAfterUnix = Math.floor(Date.now() / 1000) - lookbackSeconds;

      // Reconcile checkout.session.completed events
      const checkoutEvents = await this.paymentService.listRecentEvents(
        'checkout.session.completed',
        createdAfterUnix
      );

      for (const event of checkoutEvents) {
        const processed = await this.webhookEventStore.hasProcessedEvent(event.id);
        if (processed) {
          skipped += 1;
          continue;
        }

        // Attempt to claim and process — claimEvent is idempotent
        const claim = await this.webhookEventStore.claimEvent(event.id, {
          type: event.type,
          livemode: event.livemode,
        });

        if (claim.state === 'processed') {
          skipped += 1;
          continue;
        }

        if (claim.state === 'in_progress') {
          skipped += 1;
          continue;
        }

        try {
          const session = event.data.object as import('stripe').Stripe.Checkout.Session;
          await this.handlers.handleCheckoutSessionCompleted(session);
          await this.webhookEventStore.markProcessed(event.id);
          reconciled += 1;
          this.log.info('Reconciled missed checkout webhook', {
            eventId: event.id,
            sessionId: session.id,
          });
        } catch (error) {
          const errorInstance = error instanceof Error ? error : new Error(String(error));
          await this.webhookEventStore.markFailed(event.id, errorInstance);
          this.log.warn('Failed to reconcile checkout webhook', {
            eventId: event.id,
            error: errorInstance.message,
          });
        }
      }

      // Reconcile invoice.paid events
      const invoiceEvents = await this.paymentService.listRecentEvents(
        'invoice.paid',
        createdAfterUnix
      );

      for (const event of invoiceEvents) {
        const processed = await this.webhookEventStore.hasProcessedEvent(event.id);
        if (processed) {
          skipped += 1;
          continue;
        }

        const claim = await this.webhookEventStore.claimEvent(event.id, {
          type: event.type,
          livemode: event.livemode,
        });

        if (claim.state === 'processed' || claim.state === 'in_progress') {
          skipped += 1;
          continue;
        }

        try {
          const invoice = event.data.object as import('stripe').Stripe.Invoice;
          await this.handlers.handleInvoicePaid(invoice, event.id);
          await this.webhookEventStore.markProcessed(event.id);
          reconciled += 1;
          this.log.info('Reconciled missed invoice webhook', {
            eventId: event.id,
            invoiceId: invoice.id,
          });
        } catch (error) {
          const errorInstance = error instanceof Error ? error : new Error(String(error));
          await this.webhookEventStore.markFailed(event.id, errorInstance);
          this.log.warn('Failed to reconcile invoice webhook', {
            eventId: event.id,
            error: errorInstance.message,
          });
        }
      }

      if (reconciled > 0) {
        this.log.info('Webhook reconciliation run completed', {
          reconciled,
          skipped,
          checkoutEventsScanned: checkoutEvents.length,
          invoiceEventsScanned: invoiceEvents.length,
        });
      }

      if (reconciled > 0) {
        this.metrics?.recordAlert('webhook_reconciliation_recovered_total', { count: reconciled });
      }

      this.lastRunAt = new Date();
      this.consecutiveFailures = 0;
      return true;
    } catch (error) {
      this.lastRunAt = new Date();
      this.consecutiveFailures += 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.log.warn('Webhook reconciliation run failed', { error: errorMessage });
      return false;
    } finally {
      this.running = false;
    }
  }
}
