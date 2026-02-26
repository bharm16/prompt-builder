import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createStripeWebhookHandler } from '@routes/payment/webhook/handler';

type FirestoreLike = {
  collection: (name: string) => {
    doc: (id: string) => {
      get: () => Promise<{
        exists: boolean;
        data: () => Record<string, unknown> | undefined;
      }>;
      delete: () => Promise<unknown>;
    };
  };
};

const shouldRunFirestoreIntegration =
  process.env.RUN_FIREBASE_INTEGRATION === 'true' &&
  typeof process.env.FIRESTORE_EMULATOR_HOST === 'string' &&
  process.env.FIRESTORE_EMULATOR_HOST.trim().length > 0;

const describeFirestore = shouldRunFirestoreIntegration ? describe : describe.skip;

const uniqueId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

describeFirestore('Stripe Webhook Handlers (integration)', () => {
  let StripeWebhookEventStoreCtor: new () => unknown;
  let BillingProfileStoreCtor: new () => {
    getProfile: (userId: string) => Promise<Record<string, unknown> | null>;
  };
  let UserCreditServiceCtor: new () => {
    getBalance: (userId: string) => Promise<number>;
  };
  let db: FirestoreLike | null = null;

  const createdUserIds = new Set<string>();
  const createdEventIds = new Set<string>();

  beforeAll(async () => {
    const [{ StripeWebhookEventStore }, { BillingProfileStore }, { UserCreditService }, { getFirestore }] =
      await Promise.all([
        import('@services/payment/StripeWebhookEventStore'),
        import('@services/payment/BillingProfileStore'),
        import('@services/credits/UserCreditService'),
        import('@infrastructure/firebaseAdmin'),
      ]);

    StripeWebhookEventStoreCtor = StripeWebhookEventStore as new () => unknown;
    BillingProfileStoreCtor = BillingProfileStore as new () => {
      getProfile: (userId: string) => Promise<Record<string, unknown> | null>;
    };
    UserCreditServiceCtor = UserCreditService as new () => {
      getBalance: (userId: string) => Promise<number>;
    };
    db = getFirestore() as FirestoreLike;
  });

  afterAll(async () => {
    if (!db) {
      return;
    }

    for (const userId of createdUserIds) {
      await Promise.all([
        db.collection('users').doc(userId).delete().catch(() => undefined),
        db.collection('billing_profiles').doc(userId).delete().catch(() => undefined),
      ]);
    }

    for (const eventId of createdEventIds) {
      await db.collection('stripe_webhook_events').doc(eventId).delete().catch(() => undefined);
    }
  });

  const createWebhookApp = (paymentService: Record<string, unknown>) => {
    const webhookEventStore = new StripeWebhookEventStoreCtor();
    const billingProfileStore = new BillingProfileStoreCtor();
    const userCreditService = new UserCreditServiceCtor();

    const webhookHandler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: billingProfileStore as never,
      userCreditService: userCreditService as never,
    });

    const app = express();
    app.post('/api/payment/webhook', express.raw({ type: 'application/json' }), webhookHandler);

    return { app, billingProfileStore, userCreditService };
  };

  it('grants credits for one-time checkout.session.completed', async () => {
    const userId = uniqueId('it-webhook-payment-user');
    const eventId = uniqueId('evt-it-payment');
    createdUserIds.add(userId);
    createdEventIds.add(eventId);

    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: eventId,
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: uniqueId('cs'),
            mode: 'payment',
            metadata: {
              userId,
              creditAmount: '250',
            },
            customer: 'cus_one_time',
          },
        },
      }),
      resolveUserIdForInvoice: vi.fn(),
      calculateCreditsForInvoice: vi.fn(),
    };

    const { app, userCreditService } = createWebhookApp(paymentService);

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(200);
    expect(response.body.received).toBe(true);
    expect(await userCreditService.getBalance(userId)).toBe(250);

    const eventDoc = await db?.collection('stripe_webhook_events').doc(eventId).get();
    expect(eventDoc?.data()?.status).toBe('processed');
  });

  it('treats duplicate webhook events as idempotent no-ops', async () => {
    const userId = uniqueId('it-webhook-dup-user');
    const eventId = uniqueId('evt-it-dup');
    createdUserIds.add(userId);
    createdEventIds.add(eventId);

    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: eventId,
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: uniqueId('cs'),
            mode: 'payment',
            metadata: {
              userId,
              creditAmount: '100',
            },
            customer: 'cus_dup',
          },
        },
      }),
      resolveUserIdForInvoice: vi.fn(),
      calculateCreditsForInvoice: vi.fn(),
    };

    const { app, userCreditService } = createWebhookApp(paymentService);

    const first = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_dup')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ first: true })));

    const second = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_dup')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ second: true })));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.duplicate).toBe(true);
    expect(await userCreditService.getBalance(userId)).toBe(100);
  });

  it('does not grant credits for subscription checkout and persists billing profile', async () => {
    const userId = uniqueId('it-webhook-sub-user');
    const eventId = uniqueId('evt-it-subscription');
    createdUserIds.add(userId);
    createdEventIds.add(eventId);

    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: eventId,
        type: 'checkout.session.completed',
        livemode: false,
        data: {
          object: {
            id: uniqueId('cs'),
            mode: 'subscription',
            metadata: {
              userId,
              creditAmount: '999',
            },
            customer: 'cus_sub_123',
            subscription: 'sub_123',
            livemode: false,
          },
        },
      }),
      resolveUserIdForInvoice: vi.fn(),
      calculateCreditsForInvoice: vi.fn(),
    };

    const { app, billingProfileStore, userCreditService } = createWebhookApp(paymentService);

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_sub')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ subscription: true })));

    expect(response.status).toBe(200);
    expect(await userCreditService.getBalance(userId)).toBe(0);

    const profile = await billingProfileStore.getProfile(userId);
    expect(profile?.stripeCustomerId).toBe('cus_sub_123');
    expect(profile?.stripeSubscriptionId).toBe('sub_123');
  });

  it('grants subscription credits on invoice.paid and updates plan tier', async () => {
    const userId = uniqueId('it-webhook-invoice-user');
    const eventId = uniqueId('evt-it-invoice');
    createdUserIds.add(userId);
    createdEventIds.add(eventId);

    const invoice = {
      id: uniqueId('in'),
      livemode: false,
      amount_paid: 2000,
      customer: 'cus_invoice_123',
      subscription: 'sub_invoice_123',
      lines: {
        data: [
          {
            price: { id: 'price_creator_monthly' },
            quantity: 1,
            proration: false,
            amount: 2000,
            metadata: { userId },
          },
        ],
      },
    };

    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: eventId,
        type: 'invoice.paid',
        livemode: false,
        data: {
          object: invoice,
        },
      }),
      resolveUserIdForInvoice: vi.fn().mockResolvedValue(userId),
      calculateCreditsForInvoice: vi.fn().mockReturnValue({
        credits: 1800,
        missingPriceIds: [],
      }),
    };

    const { app, billingProfileStore, userCreditService } = createWebhookApp(paymentService);

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_invoice')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ invoice: true })));

    expect(response.status).toBe(200);
    expect(await userCreditService.getBalance(userId)).toBe(1800);

    const profile = await billingProfileStore.getProfile(userId);
    expect(profile?.planTier).toBe('creator');
    expect(profile?.stripeCustomerId).toBe('cus_invoice_123');
    expect(profile?.stripeSubscriptionId).toBe('sub_invoice_123');
  });
});
