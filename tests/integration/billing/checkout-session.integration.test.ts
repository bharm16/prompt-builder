import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiAuthMiddleware } from '@middleware/apiAuth';
import { createPaymentHandlers } from '@routes/payment/handlers';

const TEST_API_KEY = 'integration-payment-key';
const TEST_ORIGIN = 'https://promptcanvas.test';

type PaymentServiceMock = {
  isPriceIdConfigured: ReturnType<typeof vi.fn>;
  createCheckoutSession: ReturnType<typeof vi.fn>;
  createCustomer: ReturnType<typeof vi.fn>;
};

type BillingProfileStoreMock = {
  getProfile: ReturnType<typeof vi.fn>;
  upsertProfile: ReturnType<typeof vi.fn>;
};

function createCheckoutApp(paymentService: PaymentServiceMock, billingProfileStore: BillingProfileStoreMock) {
  const app = express();
  app.use(express.json());

  const router = express.Router();
  const handlers = createPaymentHandlers({
    paymentService: paymentService as never,
    billingProfileStore: billingProfileStore as never,
  });

  router.post('/checkout', handlers.createCheckoutSession);
  app.use('/api/payment', apiAuthMiddleware, router);

  return app;
}

describe('Checkout Session Creation (integration)', () => {
  let previousAllowedApiKeys: string | undefined;

  beforeEach(() => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
  });

  afterEach(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
      return;
    }
    process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
  });

  it('POST /api/payment/checkout returns checkout URL for valid priceId', async () => {
    const paymentService = {
      isPriceIdConfigured: vi.fn().mockReturnValue(true),
      createCheckoutSession: vi.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      }),
      createCustomer: vi.fn().mockResolvedValue({
        id: 'cus_test_123',
        livemode: false,
      }),
    };

    const billingProfileStore = {
      getProfile: vi.fn().mockResolvedValue(null),
      upsertProfile: vi.fn().mockResolvedValue(undefined),
    };

    const app = createCheckoutApp(paymentService, billingProfileStore);

    const response = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .set('Origin', TEST_ORIGIN)
      .send({ priceId: 'price_explorer_monthly' });

    expect(response.status).toBe(200);
    expect(response.body.url).toMatch(/^https:\/\/checkout\.stripe\.com/);
    expect(paymentService.createCustomer).toHaveBeenCalledTimes(1);
    expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith(
      `api-key:${TEST_API_KEY}`,
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        stripeLivemode: false,
      })
    );
    expect(paymentService.createCheckoutSession).toHaveBeenCalledWith(
      `api-key:${TEST_API_KEY}`,
      'price_explorer_monthly',
      `${TEST_ORIGIN}/settings/billing`,
      'cus_test_123'
    );
  });

  it('POST /api/payment/checkout rejects unknown priceId', async () => {
    const paymentService = {
      isPriceIdConfigured: vi.fn().mockReturnValue(false),
      createCheckoutSession: vi.fn(),
      createCustomer: vi.fn(),
    };

    const billingProfileStore = {
      getProfile: vi.fn(),
      upsertProfile: vi.fn(),
    };

    const app = createCheckoutApp(paymentService, billingProfileStore);

    const response = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .set('Origin', TEST_ORIGIN)
      .send({ priceId: 'price_nonexistent' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Unknown priceId');
    expect(paymentService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('POST /api/payment/checkout rejects unauthenticated requests', async () => {
    const paymentService = {
      isPriceIdConfigured: vi.fn().mockReturnValue(true),
      createCheckoutSession: vi.fn(),
      createCustomer: vi.fn(),
    };

    const billingProfileStore = {
      getProfile: vi.fn(),
      upsertProfile: vi.fn(),
    };

    const app = createCheckoutApp(paymentService, billingProfileStore);

    const response = await request(app)
      .post('/api/payment/checkout')
      .set('Origin', TEST_ORIGIN)
      .send({ priceId: 'price_explorer_monthly' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('reuses an existing Stripe customer when billing profile already exists', async () => {
    const paymentService = {
      isPriceIdConfigured: vi.fn().mockReturnValue(true),
      createCheckoutSession: vi.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/pay/cs_test_existing',
      }),
      createCustomer: vi.fn(),
    };

    const billingProfileStore = {
      getProfile: vi.fn().mockResolvedValue({
        stripeCustomerId: 'cus_existing_123',
      }),
      upsertProfile: vi.fn(),
    };

    const app = createCheckoutApp(paymentService, billingProfileStore);

    const response = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .set('Origin', TEST_ORIGIN)
      .send({ priceId: 'price_creator_monthly' });

    expect(response.status).toBe(200);
    expect(paymentService.createCustomer).not.toHaveBeenCalled();
    expect(paymentService.createCheckoutSession).toHaveBeenCalledWith(
      `api-key:${TEST_API_KEY}`,
      'price_creator_monthly',
      `${TEST_ORIGIN}/settings/billing`,
      'cus_existing_123'
    );
    expect(billingProfileStore.upsertProfile).not.toHaveBeenCalled();
  });
});
