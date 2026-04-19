import type { PaymentService } from "./PaymentService";
import type { StripeWebhookEventStore } from "./StripeWebhookEventStore";
import {
  createWebhookEventHandlers,
  type WebhookEventHandlers,
} from "@routes/payment/webhook/handlers";
import type { BillingProfileStore } from "./BillingProfileStore";
import type { UserCreditService } from "@services/credits/UserCreditService";
import type { PaymentConsistencyStore } from "./PaymentConsistencyStore";
import {
  PollingWorkerBase,
  type PollingWorkerMetrics,
} from "@services/polling/PollingWorkerBase";

const DEFAULT_LOOKBACK_HOURS = 72;

interface WebhookReconciliationWorkerOptions {
  pollIntervalMs: number;
  maxPollIntervalMs?: number;
  backoffFactor?: number;
  lookbackHours?: number;
  metrics?: PollingWorkerMetrics;
}

export class WebhookReconciliationWorker extends PollingWorkerBase {
  private readonly paymentService: PaymentService;
  private readonly webhookEventStore: StripeWebhookEventStore;
  private readonly paymentConsistencyStore: PaymentConsistencyStore;
  private readonly handlers: WebhookEventHandlers;
  private readonly lookbackHours: number;
  private readonly reconcilerMetrics: PollingWorkerMetrics | undefined;
  private running = false;

  constructor(
    paymentService: PaymentService,
    webhookEventStore: StripeWebhookEventStore,
    billingProfileStore: BillingProfileStore,
    userCreditService: UserCreditService,
    paymentConsistencyStore: PaymentConsistencyStore,
    options: WebhookReconciliationWorkerOptions,
  ) {
    super({
      workerId: "WebhookReconciliationWorker",
      basePollIntervalMs: options.pollIntervalMs,
      maxPollIntervalMs:
        options.maxPollIntervalMs ??
        Math.max(options.pollIntervalMs * 4, 600_000),
      ...(options.backoffFactor !== undefined
        ? { backoffFactor: options.backoffFactor }
        : {}),
      ...(options.metrics ? { metrics: options.metrics } : {}),
    });
    this.paymentService = paymentService;
    this.webhookEventStore = webhookEventStore;
    this.paymentConsistencyStore = paymentConsistencyStore;
    this.lookbackHours = options.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
    this.reconcilerMetrics = options.metrics;

    this.handlers = createWebhookEventHandlers({
      paymentService,
      billingProfileStore,
      userCreditService,
      paymentConsistencyStore,
      ...(this.reconcilerMetrics
        ? { metricsService: this.reconcilerMetrics }
        : {}),
    });
  }

  override start(): void {
    if (this.isStarted()) return;
    super.start();
    this.log.info("Webhook reconciliation worker started", {
      pollIntervalMs: this.basePollIntervalMs,
      lookbackHours: this.lookbackHours,
    });
  }

  protected async runOnce(): Promise<boolean> {
    if (this.running) return true;
    this.running = true;

    let reconciled = 0;
    let skipped = 0;

    try {
      const lookbackSeconds = this.lookbackHours * 3600;
      const createdAfterUnix = Math.floor(Date.now() / 1000) - lookbackSeconds;

      // Reconcile checkout.session.completed events
      const checkoutEvents = await this.paymentService.listRecentEvents(
        "checkout.session.completed",
        createdAfterUnix,
      );

      for (const event of checkoutEvents) {
        const processed = await this.webhookEventStore.hasProcessedEvent(
          event.id,
        );
        if (processed) {
          skipped += 1;
          continue;
        }

        // Attempt to claim and process — claimEvent is idempotent
        const claim = await this.webhookEventStore.claimEvent(event.id, {
          type: event.type,
          livemode: event.livemode,
        });

        if (claim.state === "processed") {
          skipped += 1;
          continue;
        }

        if (claim.state === "in_progress") {
          skipped += 1;
          continue;
        }

        try {
          const session = event.data
            .object as import("stripe").Stripe.Checkout.Session;
          await this.handlers.handleCheckoutSessionCompleted(session, event.id);
          await this.webhookEventStore.markProcessed(event.id);
          reconciled += 1;
          this.log.info("Reconciled missed checkout webhook", {
            eventId: event.id,
            sessionId: session.id,
          });
        } catch (error) {
          const errorInstance =
            error instanceof Error ? error : new Error(String(error));
          await this.webhookEventStore.markFailed(event.id, errorInstance);
          this.log.warn("Failed to reconcile checkout webhook", {
            eventId: event.id,
            error: errorInstance.message,
          });
        }
      }

      // Reconcile invoice.paid events
      const invoiceEvents = await this.paymentService.listRecentEvents(
        "invoice.paid",
        createdAfterUnix,
      );

      for (const event of invoiceEvents) {
        const processed = await this.webhookEventStore.hasProcessedEvent(
          event.id,
        );
        if (processed) {
          skipped += 1;
          continue;
        }

        const claim = await this.webhookEventStore.claimEvent(event.id, {
          type: event.type,
          livemode: event.livemode,
        });

        if (claim.state === "processed" || claim.state === "in_progress") {
          skipped += 1;
          continue;
        }

        try {
          const invoice = event.data.object as import("stripe").Stripe.Invoice;
          await this.handlers.handleInvoicePaid(invoice, event.id);
          await this.webhookEventStore.markProcessed(event.id);
          reconciled += 1;
          this.log.info("Reconciled missed invoice webhook", {
            eventId: event.id,
            invoiceId: invoice.id,
          });
        } catch (error) {
          const errorInstance =
            error instanceof Error ? error : new Error(String(error));
          await this.webhookEventStore.markFailed(event.id, errorInstance);
          this.log.warn("Failed to reconcile invoice webhook", {
            eventId: event.id,
            error: errorInstance.message,
          });
        }
      }

      if (reconciled > 0) {
        this.log.info("Webhook reconciliation run completed", {
          reconciled,
          skipped,
          checkoutEventsScanned: checkoutEvents.length,
          invoiceEventsScanned: invoiceEvents.length,
        });
      }

      if (reconciled > 0) {
        this.reconcilerMetrics?.recordAlert(
          "webhook_reconciliation_recovered_total",
          {
            count: reconciled,
          },
        );
      }

      // Edge-of-window alerting: warn if unprocessed events are near the lookback boundary
      const edgeWindowUnix =
        createdAfterUnix + Math.floor(lookbackSeconds * 0.1);
      const allEvents = [...checkoutEvents, ...invoiceEvents];
      const nearEdgeUnprocessed = allEvents.filter((e) => {
        const eventCreated = typeof e.created === "number" ? e.created : 0;
        return eventCreated > 0 && eventCreated < edgeWindowUnix;
      });
      if (nearEdgeUnprocessed.length > 0) {
        const oldestEventAgeSec =
          Math.floor(Date.now() / 1000) -
          Math.min(...nearEdgeUnprocessed.map((e) => e.created));
        this.log.warn("Unprocessed webhook events near lookback window edge", {
          count: nearEdgeUnprocessed.length,
          oldestEventAgeSec,
          lookbackHours: this.lookbackHours,
        });
        this.reconcilerMetrics?.recordAlert("webhook_lookback_edge_warning", {
          count: nearEdgeUnprocessed.length,
          oldestEventAgeSec,
          lookbackHours: this.lookbackHours,
        });
      }

      const [webhookBacklog, unresolvedSummary] = await Promise.all([
        this.webhookEventStore.getUnprocessedSummary(),
        this.paymentConsistencyStore.getUnresolvedSummary(),
      ]);

      if (webhookBacklog.totalUnprocessed > 0) {
        const oldestUnprocessedAgeSec =
          webhookBacklog.oldestUnprocessedAgeMs === null
            ? null
            : Math.floor(webhookBacklog.oldestUnprocessedAgeMs / 1000);
        this.log.warn("Stripe webhook event backlog detected", {
          totalUnprocessed: webhookBacklog.totalUnprocessed,
          processingCount: webhookBacklog.processingCount,
          failedCount: webhookBacklog.failedCount,
          oldestUnprocessedAgeSec,
        });
        this.reconcilerMetrics?.recordAlert("stripe_webhook_backlog_warning", {
          totalUnprocessed: webhookBacklog.totalUnprocessed,
          processingCount: webhookBacklog.processingCount,
          failedCount: webhookBacklog.failedCount,
          ...(oldestUnprocessedAgeSec !== null
            ? { oldestUnprocessedAgeSec }
            : {}),
        });
      }

      if (unresolvedSummary.openCount > 0) {
        const oldestUnresolvedAgeSec =
          unresolvedSummary.oldestOpenAgeMs === null
            ? null
            : Math.floor(unresolvedSummary.oldestOpenAgeMs / 1000);
        this.log.warn("Unresolved payment events detected", {
          openCount: unresolvedSummary.openCount,
          oldestUnresolvedAgeSec,
        });
        this.reconcilerMetrics?.recordAlert(
          "payment_unresolved_events_warning",
          {
            openCount: unresolvedSummary.openCount,
            ...(oldestUnresolvedAgeSec !== null
              ? { oldestUnresolvedAgeSec }
              : {}),
          },
        );
      }

      this.markRunSuccess();
      return true;
    } catch (error) {
      this.markRunFailure();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.log.warn("Webhook reconciliation run failed", {
        error: errorMessage,
      });
      return false;
    } finally {
      this.running = false;
    }
  }
}
