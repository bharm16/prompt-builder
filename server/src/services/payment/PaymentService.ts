import Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';

interface PaymentServiceConfig {
  secretKey: string | undefined;
  webhookSecret: string | undefined;
  priceCreditsJson: string | undefined;
}

type PriceCredits = Record<string, number>;

function normalizeCreditsValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.trunc(value) : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
}

function parsePriceCredits(raw: string | undefined): PriceCredits {
  if (!raw) {
    logger.warn('STRIPE_PRICE_CREDITS is not configured; price mapping will be empty');
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    logger.error('Failed to parse STRIPE_PRICE_CREDITS JSON', error as Error);
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    logger.warn('STRIPE_PRICE_CREDITS must be a JSON object mapping price IDs to credits');
    return {};
  }

  const mapping: PriceCredits = {};
  for (const [priceId, creditsRaw] of Object.entries(parsed as Record<string, unknown>)) {
    const credits = normalizeCreditsValue(creditsRaw);
    if (!priceId || !credits) {
      logger.warn('Invalid Stripe price credit mapping entry', {
        priceId,
        credits: creditsRaw,
      });
      continue;
    }
    mapping[priceId] = credits;
  }

  if (Object.keys(mapping).length === 0) {
    logger.warn('STRIPE_PRICE_CREDITS did not include any valid entries');
  }

  return mapping;
}

function resolveUserId(metadata: Stripe.Metadata | null | undefined): string | null {
  const userId = metadata?.userId;
  if (typeof userId === 'string' && userId.trim().length > 0) {
    return userId.trim();
  }
  return null;
}

export class PaymentService {
  private stripe: Stripe | null = null;
  private readonly priceCredits: PriceCredits;
  private readonly webhookSecret: string | undefined;

  constructor(config?: PaymentServiceConfig) {
    const resolvedConfig = config ?? {
      secretKey: undefined,
      webhookSecret: undefined,
      priceCreditsJson: undefined,
    };

    this.priceCredits = parsePriceCredits(resolvedConfig.priceCreditsJson);
    this.webhookSecret = resolvedConfig.webhookSecret;

    const secretKey = resolvedConfig.secretKey;

    if (!secretKey) {
      logger.warn('STRIPE_SECRET_KEY is not configured; payment service disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
    });
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe;
  }

  private async resolveCheckoutMode(priceId: string): Promise<'subscription' | 'payment'> {
    const stripe = this.getStripe();
    const price = await stripe.prices.retrieve(priceId);
    const isRecurring = price.type === 'recurring' || Boolean(price.recurring);
    return isRecurring ? 'subscription' : 'payment';
  }

  public isPriceIdConfigured(priceId: string): boolean {
    const credits = this.priceCredits[priceId];
    return typeof credits === 'number' && Number.isFinite(credits) && credits > 0;
  }

  public getCreditsForPriceId(priceId: string): number {
    const credits = this.priceCredits[priceId];
    if (typeof credits !== 'number' || !Number.isFinite(credits) || credits <= 0) {
      throw new Error(`Unknown Stripe price ID: ${priceId}`);
    }
    return credits;
  }

  public calculateCreditsForInvoice(invoice: Stripe.Invoice): { credits: number; missingPriceIds: string[] } {
    const missingPriceIds = new Set<string>();
    let credits = 0;

    for (const line of invoice.lines?.data ?? []) {
      const priceId = line.price?.id;
      if (!priceId) {
        continue;
      }

      if (line.proration || (typeof line.amount === 'number' && line.amount <= 0)) {
        continue;
      }

      const priceCredits = this.priceCredits[priceId];
      if (!priceCredits) {
        missingPriceIds.add(priceId);
        continue;
      }

      const quantity = typeof line.quantity === 'number' && line.quantity > 0 ? line.quantity : 1;
      credits += priceCredits * quantity;
    }

    return { credits, missingPriceIds: Array.from(missingPriceIds) };
  }

  public async resolveUserIdForInvoice(invoice: Stripe.Invoice): Promise<string | null> {
    const metadataUserId = resolveUserId(invoice.subscription_details?.metadata);
    if (metadataUserId) {
      return metadataUserId;
    }

    for (const line of invoice.lines?.data ?? []) {
      const lineUserId = resolveUserId(line.metadata);
      if (lineUserId) {
        return lineUserId;
      }
    }

    const subscription = invoice.subscription;
    if (!subscription) {
      return null;
    }

    if (typeof subscription !== 'string') {
      return resolveUserId(subscription.metadata);
    }

    const stripe = this.getStripe();
    const fetched = await stripe.subscriptions.retrieve(subscription);
    return resolveUserId(fetched.metadata);
  }

  async createCheckoutSession(
    userId: string,
    priceId: string,
    returnUrl: string,
    customerId?: string
  ): Promise<{ url: string }> {
    try {
      const credits = this.getCreditsForPriceId(priceId);
      const stripe = this.getStripe();
      const mode = await this.resolveCheckoutMode(priceId);
      const session = await stripe.checkout.sessions.create({
        ...(customerId ? { customer: customerId } : {}),
        payment_method_types: ['card', 'link'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode,
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        client_reference_id: userId,
        ...(mode === 'subscription'
          ? {
              subscription_data: {
                metadata: {
                  userId,
                },
              },
            }
          : {}),
        metadata: {
          userId,
          creditAmount: String(credits),
        },
        automatic_tax: { enabled: true },
      });

      if (!session.url) {
        throw new Error('Stripe session URL was not generated');
      }

      return { url: session.url };
    } catch (error) {
      logger.error('Stripe Checkout Error', error as Error);
      throw error;
    }
  }

  async createCustomer(userId: string): Promise<{ id: string; livemode: boolean }> {
    const stripe = this.getStripe();
    const customer = await stripe.customers.create({
      metadata: {
        userId,
      },
    });

    return { id: customer.id, livemode: customer.livemode };
  }

  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    if (!session.url) {
      throw new Error('Stripe billing portal session URL was not generated');
    }

    return { url: session.url };
  }

  async listInvoices(customerId: string, limit = 20): Promise<Stripe.Invoice[]> {
    const stripe = this.getStripe();
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  }

  constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const stripe = this.getStripe();

    if (!this.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }
}
