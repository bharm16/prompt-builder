import type { Request, Response } from 'express';
import { logger } from '@infrastructure/Logger';
import type { PaymentRouteDeps } from './types';
import { resolveUserId } from './auth';

export interface PaymentHandlers {
  listInvoices: (req: Request, res: Response) => Promise<Response | void>;
  createPortalSession: (req: Request, res: Response) => Promise<Response | void>;
  createCheckoutSession: (req: Request, res: Response) => Promise<Response | void>;
}

export const createPaymentHandlers = ({
  paymentService,
  billingProfileStore,
}: PaymentRouteDeps): PaymentHandlers => ({
  async listInvoices(req, res) {
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
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to list invoices', errorInstance, { userId });
      return res.status(500).json({ error: 'Failed to load invoices' });
    }
  },

  async createPortalSession(req, res) {
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

      const session = await paymentService.createBillingPortalSession(
        stripeCustomerId,
        `${origin}/settings/billing`
      );
      return res.json(session);
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create billing portal session', errorInstance, { userId });
      return res.status(500).json({ error: 'Failed to create billing portal session' });
    }
  },

  async createCheckoutSession(req, res) {
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
      } catch (error: unknown) {
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
    } catch (error: unknown) {
      const errorInstance = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to create checkout session', errorInstance, {
        userId,
        priceId: normalizedPriceId,
      });
      return res.status(500).json({ error: 'Failed to create checkout session' });
    }
  },
});
