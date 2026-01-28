import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';
import type { WebhookHandlerDeps } from '../types';
import { createWebhookEventHandlers } from './handlers';

export const createStripeWebhookHandler = ({
  paymentService,
  webhookEventStore,
  billingProfileStore,
  userCreditService,
}: WebhookHandlerDeps) =>
  async (req: Request, res: Response): Promise<Response | void> => {
    const signature = req.headers['stripe-signature'];

    if (!signature) {
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;
    try {
      event = paymentService.constructEvent(req.body, signature as string);
    } catch (err) {
      logger.error('Webhook signature verification failed', err as Error);
      return res.status(400).send(`Webhook Error: ${(err as Error).message}`);
    }

    let claim;
    try {
      claim = await webhookEventStore.claimEvent(event.id, {
        type: event.type,
        livemode: event.livemode,
      });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Stripe webhook idempotency check failed', errorInstance, {
        eventId: event.id,
        eventType: event.type,
      });
      return res.status(500).json({ error: 'Webhook handling failed' });
    }

    if (claim.state === 'processed') {
      return res.json({ received: true, duplicate: true });
    }

    if (claim.state === 'in_progress') {
      return res.status(409).json({ received: false, error: 'Webhook event is already processing' });
    }

    const { handleCheckoutSessionCompleted, handleInvoicePaid } = createWebhookEventHandlers({
      paymentService,
      billingProfileStore,
      userCreditService,
    });

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          await handleCheckoutSessionCompleted(session);
          break;
        }
        case 'invoice.paid': {
          const invoice = event.data.object as Stripe.Invoice;
          await handleInvoicePaid(invoice, event.id);
          break;
        }
        default:
          logger.info('Unhandled Stripe webhook event', { eventId: event.id, eventType: event.type });
          break;
      }

      await webhookEventStore.markProcessed(event.id);
      return res.json({ received: true });
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      await webhookEventStore.markFailed(event.id, errorInstance);
      logger.error('Stripe webhook handling failed', errorInstance, {
        eventId: event.id,
        eventType: event.type,
      });
      return res.status(500).json({ error: 'Webhook handling failed' });
    }
  };
