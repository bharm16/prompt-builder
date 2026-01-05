import Stripe from 'stripe';
import { logger } from '@infrastructure/Logger';

export class PaymentService {
  private stripe: Stripe | null = null;
  private readonly PRICE_ID_MAPPING: Record<string, number> = {
    price_creator_id_from_stripe: 800, // $29 -> 800 credits
    price_pro_id_from_stripe: 2500, // $79 -> 2500 credits
    price_power_id_from_stripe: 7000, // $199 -> 7000 credits
  };

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
      logger.warn('STRIPE_SECRET_KEY is not configured; payment service disabled');
      return;
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-01-27.acacia',
    });
  }

  private getStripe(): Stripe {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    return this.stripe;
  }

  async createCheckoutSession(userId: string, priceId: string, returnUrl: string): Promise<{ url: string }> {
    try {
      const stripe = this.getStripe();
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card', 'link'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl}?canceled=true`,
        client_reference_id: userId,
        metadata: {
          userId,
          creditAmount: String(this.PRICE_ID_MAPPING[priceId] ?? 0),
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

  constructEvent(payload: string | Buffer, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = this.getStripe();

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}
