import express, { type Request, type Response } from 'express';
import type Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';
import { admin } from '@infrastructure/firebaseAdmin';
import { PaymentService } from '@services/payment/PaymentService';
import { BillingProfileStore } from '@services/payment/BillingProfileStore';
import { StripeWebhookEventStore, type StripeWebhookClaimResult } from '@services/payment/StripeWebhookEventStore';
import { userCreditService } from '@services/credits/UserCreditService';
import { extractFirebaseToken } from '@utils/auth';

const paymentService = new PaymentService();
const webhookEventStore = new StripeWebhookEventStore();
const billingProfileStore = new BillingProfileStore();

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
    const userId = session.metadata?.userId || session.client_reference_id || null;
    const stripeCustomerId =
      typeof session.customer === 'string'
        ? session.customer
        : session.customer && typeof session.customer === 'object' && 'id' in session.customer
          ? (session.customer.id as string)
          : null;
    const stripeSubscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription && typeof session.subscription === 'object' && 'id' in session.subscription
          ? (session.subscription.id as string)
          : null;

    if (userId && stripeCustomerId) {
      try {
        await billingProfileStore.upsertProfile(userId, {
          stripeCustomerId,
          ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
          stripeLivemode: session.livemode,
        });
      } catch (error) {
        logger.error('Failed to persist billing profile from checkout', error as Error, {
          userId,
          sessionId: session.id,
        });
      }
    }

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

  const stripeCustomerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer && typeof invoice.customer === 'object' && 'id' in invoice.customer
        ? (invoice.customer.id as string)
        : null;
  const stripeSubscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription && typeof invoice.subscription === 'object' && 'id' in invoice.subscription
        ? (invoice.subscription.id as string)
        : null;

  if (stripeCustomerId) {
    try {
      await billingProfileStore.upsertProfile(userId, {
        stripeCustomerId,
        ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
        stripeLivemode: invoice.livemode,
      });
    } catch (error) {
      logger.error('Failed to persist billing profile from invoice', error as Error, {
        userId,
        invoiceId: invoice.id,
        eventId,
      });
    }
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

  router.get('/invoices', async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const profile = await billingProfileStore.getProfile(userId);
      const stripeCustomerId = profile?.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.json({ invoices: [] });
      }

      const invoices = await paymentService.listInvoices(stripeCustomerId, 20);
      return res.json({
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          number: invoice.number ?? null,
          status: invoice.status ?? null,
          created: typeof invoice.created === 'number' ? invoice.created : null,
          currency: invoice.currency ?? null,
          amountDue: typeof invoice.amount_due === 'number' ? invoice.amount_due : null,
          amountPaid: typeof invoice.amount_paid === 'number' ? invoice.amount_paid : null,
          hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
          invoicePdf: invoice.invoice_pdf ?? null,
        })),
      });
    } catch (error) {
      logger.error('Failed to list invoices', error as Error, { userId });
      return res.status(500).json({ error: 'Failed to load invoices' });
    }
  });

  router.post('/portal', async (req: Request, res: Response) => {
    const userId = await resolveUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const profile = await billingProfileStore.getProfile(userId);
      const stripeCustomerId = profile?.stripeCustomerId;
      if (!stripeCustomerId) {
        return res.status(400).json({ error: 'No billing profile found' });
      }

      const origin = req.headers.origin || process.env.FRONTEND_URL;
      if (!origin) {
        return res.status(500).json({ error: 'Billing return URL is not configured' });
      }

      const session = await paymentService.createBillingPortalSession(stripeCustomerId, `${origin}/settings/billing`);
      return res.json(session);
    } catch (error) {
      logger.error('Failed to create billing portal session', error as Error, { userId });
      return res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  });

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
      let stripeCustomerId: string | undefined;
      try {
        const profile = await billingProfileStore.getProfile(userId);
        if (profile?.stripeCustomerId) {
          stripeCustomerId = profile.stripeCustomerId;
        } else {
          const customer = await paymentService.createCustomer(userId);
          stripeCustomerId = customer.id;
          await billingProfileStore.upsertProfile(userId, {
            stripeCustomerId: customer.id,
            stripeLivemode: customer.livemode,
          });
        }
      } catch (error) {
        logger.warn('Failed to ensure Stripe customer; checkout will create one automatically', {
          userId,
          error: (error as Error).message,
        });
      }

      const session = await paymentService.createCheckoutSession(
        userId,
        normalizedPriceId,
        `${origin}/settings/billing`,
        stripeCustomerId
      );
      return res.json(session);
    } catch (error) {
      logger.error('Failed to create checkout session', error as Error, {
        userId,
        priceId: normalizedPriceId,
      });
      return res.status(500).json({ error: 'Failed to create checkout session' });
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
