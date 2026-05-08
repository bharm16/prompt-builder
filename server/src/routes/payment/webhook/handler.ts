import type { Request, Response } from "express";
import { logger } from "@infrastructure/Logger";
import type { WebhookHandlerDeps } from "../types";
import {
  describePaymentEventType,
  type PaymentEvent,
} from "@services/payment/types";
import { createWebhookEventHandlers } from "./handlers";

export const createStripeWebhookHandler =
  ({
    paymentService,
    webhookEventStore,
    billingProfileStore,
    userCreditService,
    paymentConsistencyStore,
    metricsService,
    firestoreCircuitExecutor,
  }: WebhookHandlerDeps) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    let event: PaymentEvent;
    try {
      event = paymentService.constructEvent(req.body, signature as string);
    } catch (err) {
      logger.error("Webhook signature verification failed", err as Error);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    if (
      firestoreCircuitExecutor &&
      !firestoreCircuitExecutor.isWriteAllowed()
    ) {
      const retryAfterSeconds = firestoreCircuitExecutor.getRetryAfterSeconds();
      logger.warn("Stripe webhook deferred due to Firestore write gate", {
        eventId: event.id,
        eventType: describePaymentEventType(event),
        retryAfterSeconds,
      });
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(503).json({
        error: "Webhook handling deferred while datastore recovers",
      });
    }

    let claim;
    try {
      claim = await webhookEventStore.claimEvent(event.id, {
        type: describePaymentEventType(event),
        livemode: event.livemode,
      });
    } catch (error: unknown) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      logger.error("Stripe webhook idempotency check failed", errorInstance, {
        eventId: event.id,
        eventType: describePaymentEventType(event),
      });
      return res.status(500).json({ error: "Webhook handling failed" });
    }

    if (claim.state === "processed") {
      return res.json({ received: true, duplicate: true });
    }

    if (claim.state === "in_progress") {
      return res.status(409).json({
        received: false,
        error: "Webhook event is already processing",
      });
    }

    const { handleCheckoutSessionCompleted, handleInvoicePaid } =
      createWebhookEventHandlers({
        paymentService,
        billingProfileStore,
        userCreditService,
        ...(paymentConsistencyStore ? { paymentConsistencyStore } : {}),
        ...(metricsService ? { metricsService } : {}),
      });

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          await handleCheckoutSessionCompleted(event.payload, event.id);
          break;
        }
        case "invoice.paid": {
          await handleInvoicePaid(event.payload, event.id);
          break;
        }
        default:
          logger.info("Unhandled Stripe webhook event", {
            eventId: event.id,
            eventType: describePaymentEventType(event),
          });
          break;
      }

      await webhookEventStore.markProcessed(event.id);
      return res.json({ received: true });
    } catch (error: unknown) {
      const errorInstance =
        error instanceof Error ? error : new Error(String(error));
      await webhookEventStore.markFailed(event.id, errorInstance);
      logger.error("Stripe webhook handling failed", errorInstance, {
        eventId: event.id,
        eventType: describePaymentEventType(event),
      });
      return res.status(500).json({ error: "Webhook handling failed" });
    }
  };
