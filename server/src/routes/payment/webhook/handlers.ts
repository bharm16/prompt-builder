import type Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';
import type { WebhookHandlerDeps } from '../types';
import { resolvePlanTierFromPriceIds } from '@config/subscriptionTiers';

type WebhookEventHandlerDeps = Pick<
  WebhookHandlerDeps,
  'paymentService' | 'billingProfileStore' | 'userCreditService'
>;

export interface WebhookEventHandlers {
  handleCheckoutSessionCompleted: (session: Stripe.Checkout.Session) => Promise<void>;
  handleInvoicePaid: (invoice: Stripe.Invoice, eventId: string) => Promise<void>;
}

export const createWebhookEventHandlers = ({
  paymentService,
  billingProfileStore,
  userCreditService,
}: WebhookEventHandlerDeps): WebhookEventHandlers => ({
  async handleCheckoutSessionCompleted(session) {
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

    await userCreditService.addCredits(userId, credits, {
      source: 'stripe_checkout',
      reason: 'one_time_credit_pack',
      referenceId: session.id,
    });
    logger.info('Credits funded via Stripe checkout', { userId, credits, sessionId: session.id });
  },

  async handleInvoicePaid(invoice, eventId) {
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

    const invoicePriceIds = (invoice.lines?.data ?? [])
      .map((line) => line.price?.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
    const resolvedPlanTier = resolvePlanTierFromPriceIds(invoicePriceIds);

    if (stripeCustomerId) {
      try {
        await billingProfileStore.upsertProfile(userId, {
          stripeCustomerId,
          ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
          ...(resolvedPlanTier ? { planTier: resolvedPlanTier } : {}),
          ...(invoicePriceIds[0] ? { subscriptionPriceId: invoicePriceIds[0] } : {}),
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

    await userCreditService.addCredits(userId, credits, {
      source: 'stripe_invoice',
      reason: 'subscription_invoice_paid',
      referenceId: invoice.id,
    });
    logger.info('Credits funded via Stripe invoice', { userId, credits, invoiceId: invoice.id, eventId });
  },
});
