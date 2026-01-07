import express, { type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { PaymentService } from '@services/payment/PaymentService';
import { StripeWebhookEventStore, type StripeWebhookClaimResult } from '@services/payment/StripeWebhookEventStore';
import { userCreditService } from '@services/credits/UserCreditService';
import { extractFirebaseToken } from '@utils/auth';

const paymentService = new PaymentService();
const webhookEventStore = new StripeWebhookEventStore();

async function resolveUserId(req: Request): Promise<string | null> {
  const reqWithAuth = req as Request & { user?: { uid?: string }; apiKey?: string; body?: { userId?: string } };

  if (reqWithAuth.user?.uid) {
    return reqWithAuth.user.uid;
  }

  const token = extractFirebaseToken(req);
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const uid = decoded.uid;
      reqWithAuth.user = { uid };
      return uid;
    } catch (error) {
      logger.warn('Failed to verify auth token for payment request', {
        path: req.path,
        error: (error as Error).message,
      });
    }
  }

  if (reqWithAuth.body?.userId) {
    return reqWithAuth.body.userId;
  }

  if (reqWithAuth.apiKey) {
    return reqWithAuth.apiKey;
  }

  return null;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode === 'subscription') {
    logger.info('Subscription checkout completed; credits will be applied on invoice.paid', {
      sessionId: session.id,
      subscriptionId: session.subscription,
    });
    return;
  }

  const userId = session.metadata?.userId || session.client_reference_id || null;
  const credits = Number.parseInt(session.metadata?.creditAmount ?? '0', 10);

  if (!userId) {
    logger.warn('Checkout session missing user identifier', { sessionId: session.id });
    return;
  }

  if (!Number.isFinite(credits) || credits <= 0) {
    logger.warn('Checkout session missing credit metadata', { sessionId: session.id });
    return;
  }

  await userCreditService.addCredits(userId, credits);
  logger.info('Credits funded via Stripe checkout', { userId, credits, sessionId: session.id });
}

async function handleInvoicePaid(invoice: Stripe.Invoice, eventId: string): Promise<void> {
  const userId = await paymentService.resolveUserIdForInvoice(invoice);
  if (!userId) {
    logger.warn('Invoice paid without user metadata', {
      invoiceId: invoice.id,
      eventId,
      subscriptionId: invoice.subscription,
      customerId: invoice.customer,
    });
    return;
  }

  const { credits, missingPriceIds } = paymentService.calculateCreditsForInvoice(invoice);
  if (invoice.amount_paid <= 0) {
    logger.info('Invoice paid with zero amount; skipping credit grant', {
      invoiceId: invoice.id,
      eventId,
      userId,
    });
    return;
  }

  if (missingPriceIds.length > 0) {
    throw new Error(
      `Invoice ${invoice.id} missing credit mapping for price IDs: ${missingPriceIds.join(', ')}`
    );
  }

  if (credits <= 0) {
    throw new Error(`Invoice ${invoice.id} paid but credits resolved to 0`);
  }

  await userCreditService.addCredits(userId, credits);
  logger.info('Credits funded via Stripe invoice', { userId, credits, invoiceId: invoice.id, eventId });
}

export const createPaymentRoutes = (): express.Router => {
  const router = express.Router();

  router.post('/checkout', async (req: Request, res: Response) => {
    const { priceId } = req.body ?? {};
    const userId = await resolveUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (typeof priceId !== 'string' || priceId.trim() === '') {
      return res.status(400).json({ error: 'Invalid priceId' });
    }

    const normalizedPriceId = priceId.trim();
    if (!paymentService.isPriceIdConfigured(normalizedPriceId)) {
      return res.status(400).json({ error: 'Unknown priceId' });
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL;
    if (!origin) {
      logger.error('Missing origin for checkout return URL');
      return res.status(500).json({ error: 'Billing return URL is not configured' });
    }

    try {
      const session = await paymentService.createCheckoutSession(
        userId,
        normalizedPriceId,
        `${origin}/settings/billing`
      );
      res.json(session);
    } catch (error) {
      logger.error('Failed to create checkout session', error as Error, {
        userId,
        priceId: normalizedPriceId,
      });
      res.status(500).json({ error: 'Failed to create checkout session' });
    }
  });

  return router;
};

export const createWebhookRoutes = (): express.Router => {
  const router = express.Router();

  router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
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

    let claim: StripeWebhookClaimResult;
    try {
      claim = await webhookEventStore.claimEvent(event.id, {
        type: event.type,
        livemode: event.livemode,
      });
    } catch (error) {
      logger.error('Stripe webhook idempotency check failed', error as Error, {
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
    } catch (error) {
      await webhookEventStore.markFailed(event.id, error as Error);
      logger.error('Stripe webhook handling failed', error as Error, {
        eventId: event.id,
        eventType: event.type,
      });
      return res.status(500).json({ error: 'Webhook handling failed' });
    }
  });

  return router;
};
