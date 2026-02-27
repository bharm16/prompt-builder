import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServices, initializeServices } from '@config/services.config';
import { createApp } from '@server/app';

const TEST_API_KEY = 'phase2-payment-key';
const TEST_USER_ID = `api-key:${TEST_API_KEY}`;
const TEST_ALLOWED_ORIGIN = 'http://localhost:5173';

const {
  paymentServiceMock,
  billingProfileStoreMock,
  webhookEventStoreMock,
  userCreditServiceMock,
  paymentConsistencyStoreMock,
} = vi.hoisted(() => {
  const paymentServiceMock = {
    listInvoices: vi.fn(),
    createBillingPortalSession: vi.fn(),
    isPriceIdConfigured: vi.fn(),
    createCheckoutSession: vi.fn(),
    createCustomer: vi.fn(),
    constructEvent: vi.fn(),
    resolveUserIdForInvoice: vi.fn(),
    calculateCreditsForInvoice: vi.fn(),
  };

  const billingProfileStoreMock = {
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
  };

  const webhookEventStoreMock = {
    claimEvent: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
  };

  const userCreditServiceMock = {
    addCredits: vi.fn(),
    getStarterGrantInfo: vi.fn(),
    listCreditTransactions: vi.fn(),
    ensureStarterGrant: vi.fn(),
  };

  const paymentConsistencyStoreMock = {
    recordUnresolvedEvent: vi.fn(),
    getUnresolvedSummary: vi.fn(),
    enqueueBillingProfileRepair: vi.fn(),
    claimNextBillingProfileRepair: vi.fn(),
    markBillingProfileRepairResolved: vi.fn(),
    releaseBillingProfileRepairForRetry: vi.fn(),
    markBillingProfileRepairEscalated: vi.fn(),
  };

  return {
    paymentServiceMock,
    billingProfileStoreMock,
    webhookEventStoreMock,
    userCreditServiceMock,
    paymentConsistencyStoreMock,
  };
});

vi.mock('@services/payment/PaymentService', () => ({
  PaymentService: vi.fn(() => paymentServiceMock),
}));

vi.mock('@services/payment/BillingProfileStore', () => ({
  BillingProfileStore: vi.fn(() => billingProfileStoreMock),
}));

vi.mock('@services/payment/StripeWebhookEventStore', () => ({
  StripeWebhookEventStore: vi.fn(() => webhookEventStoreMock),
}));

vi.mock('@services/payment/PaymentConsistencyStore', () => ({
  PaymentConsistencyStore: vi.fn(() => paymentConsistencyStoreMock),
}));

vi.mock('@services/credits/UserCreditService', () => ({
  userCreditService: userCreditServiceMock,
}));

describe('Payment Routes (full-stack integration)', () => {
  let app: Application;
  let previousAllowedApiKeys: string | undefined;
  let previousFrontendUrl: string | undefined;
  let previousPort: string | undefined;

  beforeAll(async () => {
    previousAllowedApiKeys = process.env.ALLOWED_API_KEYS;
    previousFrontendUrl = process.env.FRONTEND_URL;
    previousPort = process.env.PORT;

    process.env.ALLOWED_API_KEYS = TEST_API_KEY;
    process.env.FRONTEND_URL = 'https://frontend.promptcanvas.test';
    process.env.PORT = '0';

    const container = await configureServices();
    await initializeServices(container);
    app = createApp(container);
  }, 30_000);

  afterAll(() => {
    if (previousAllowedApiKeys === undefined) {
      delete process.env.ALLOWED_API_KEYS;
    } else {
      process.env.ALLOWED_API_KEYS = previousAllowedApiKeys;
    }

    if (previousFrontendUrl === undefined) {
      delete process.env.FRONTEND_URL;
    } else {
      process.env.FRONTEND_URL = previousFrontendUrl;
    }

    if (previousPort === undefined) {
      delete process.env.PORT;
      return;
    }
    process.env.PORT = previousPort;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    paymentServiceMock.listInvoices.mockResolvedValue([
      {
        id: 'in_test_1',
        number: 'INV-1',
        status: 'paid',
        created: 1700000000,
        currency: 'usd',
        amount_due: 2000,
        amount_paid: 2000,
        hosted_invoice_url: 'https://stripe.example/in_test_1',
        invoice_pdf: 'https://stripe.example/in_test_1.pdf',
      },
    ]);
    paymentServiceMock.createBillingPortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session_123',
    });
    paymentServiceMock.isPriceIdConfigured.mockImplementation((priceId: string) =>
      ['price_explorer_monthly', 'price_creator_monthly'].includes(priceId)
    );
    paymentServiceMock.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/pay/cs_test_123',
    });
    paymentServiceMock.createCustomer.mockResolvedValue({
      id: 'cus_test_123',
      livemode: false,
    });

    billingProfileStoreMock.getProfile.mockResolvedValue(null);
    billingProfileStoreMock.upsertProfile.mockResolvedValue(undefined);

    webhookEventStoreMock.claimEvent.mockResolvedValue({ state: 'claimed' });
    webhookEventStoreMock.markProcessed.mockResolvedValue(undefined);
    webhookEventStoreMock.markFailed.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.recordUnresolvedEvent.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.getUnresolvedSummary.mockResolvedValue({ openCount: 0, oldestOpenAgeMs: null });
    paymentConsistencyStoreMock.enqueueBillingProfileRepair.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.claimNextBillingProfileRepair.mockResolvedValue(null);
    paymentConsistencyStoreMock.markBillingProfileRepairResolved.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.releaseBillingProfileRepairForRetry.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.markBillingProfileRepairEscalated.mockResolvedValue(undefined);

    userCreditServiceMock.addCredits.mockResolvedValue(undefined);
    userCreditServiceMock.ensureStarterGrant.mockResolvedValue(false);
    userCreditServiceMock.getStarterGrantInfo.mockResolvedValue({
      starterGrantCredits: null,
      starterGrantGrantedAtMs: null,
    });
    userCreditServiceMock.listCreditTransactions.mockResolvedValue([]);
  });

  it('GET /api/payment/invoices rejects unauthenticated requests', async () => {
    const response = await request(app).get('/api/payment/invoices');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('GET /api/payment/invoices returns an empty list when user has no billing profile', async () => {
    const response = await request(app)
      .get('/api/payment/invoices')
      .set('x-api-key', TEST_API_KEY);

    expect(response.status).toBe(200);
    expect(response.body.invoices).toEqual([]);
    expect(billingProfileStoreMock.getProfile).toHaveBeenCalledWith(TEST_USER_ID);
    expect(paymentServiceMock.listInvoices).not.toHaveBeenCalled();
  });

  it('GET /api/payment/invoices returns 500 when invoice listing fails', async () => {
    billingProfileStoreMock.getProfile.mockResolvedValueOnce({
      stripeCustomerId: 'cus_test_123',
    });
    paymentServiceMock.listInvoices.mockRejectedValueOnce(new Error('Stripe unavailable'));

    const response = await request(app)
      .get('/api/payment/invoices')
      .set('x-api-key', TEST_API_KEY);

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Failed to load invoices');
  });

  it('GET /api/payment/status returns billing status payload', async () => {
    billingProfileStoreMock.getProfile.mockResolvedValueOnce({
      planTier: 'explorer',
      stripeSubscriptionId: 'sub_123',
    });
    userCreditServiceMock.getStarterGrantInfo.mockResolvedValueOnce({
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });

    const response = await request(app)
      .get('/api/payment/status')
      .set('x-api-key', TEST_API_KEY);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      planTier: 'explorer',
      isSubscribed: true,
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });
  });

  it('GET /api/payment/credits/history returns transaction list', async () => {
    userCreditServiceMock.listCreditTransactions.mockResolvedValueOnce([
      {
        id: 'txn_1',
        type: 'add',
        amount: 25,
        source: 'starter-grant',
        reason: null,
        referenceId: null,
        createdAtMs: 1700000000000,
      },
    ]);

    const response = await request(app)
      .get('/api/payment/credits/history?limit=10')
      .set('x-api-key', TEST_API_KEY);

    expect(response.status).toBe(200);
    expect(response.body.transactions).toEqual([
      {
        id: 'txn_1',
        type: 'add',
        amount: 25,
        source: 'starter-grant',
        reason: null,
        referenceId: null,
        createdAtMs: 1700000000000,
      },
    ]);
    expect(userCreditServiceMock.listCreditTransactions).toHaveBeenCalledWith(TEST_USER_ID, 10);
  });

  it('POST /api/payment/portal rejects unauthenticated requests', async () => {
    const response = await request(app).post('/api/payment/portal');

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('POST /api/payment/portal returns 400 when no billing profile exists', async () => {
    const response = await request(app)
      .post('/api/payment/portal')
      .set('x-api-key', TEST_API_KEY);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('No billing profile found');
  });

  it('POST /api/payment/portal returns 500 when return URL is unavailable', async () => {
    const previousFrontendUrlForTest = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;

    billingProfileStoreMock.getProfile.mockResolvedValueOnce({
      stripeCustomerId: 'cus_test_123',
    });

    try {
      const response = await request(app)
        .post('/api/payment/portal')
        .set('x-api-key', TEST_API_KEY);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Billing return URL is not configured');
    } finally {
      if (previousFrontendUrlForTest === undefined) {
        delete process.env.FRONTEND_URL;
      } else {
        process.env.FRONTEND_URL = previousFrontendUrlForTest;
      }
    }
  });

  it('POST /api/payment/portal returns session URL for users with billing profiles', async () => {
    billingProfileStoreMock.getProfile.mockResolvedValueOnce({
      stripeCustomerId: 'cus_test_123',
    });

    const response = await request(app)
      .post('/api/payment/portal')
      .set('x-api-key', TEST_API_KEY)
      .set('Origin', TEST_ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('https://billing.stripe.com/session_123');
    expect(paymentServiceMock.createBillingPortalSession).toHaveBeenCalledWith(
      'cus_test_123',
      `${TEST_ALLOWED_ORIGIN}/settings/billing`
    );
  });

  it('POST /api/payment/checkout rejects unauthenticated requests', async () => {
    const response = await request(app)
      .post('/api/payment/checkout')
      .send({ priceId: 'price_explorer_monthly' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Authentication required');
  });

  it('POST /api/payment/checkout rejects invalid and unknown price IDs', async () => {
    const invalidTypeResponse = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .send({ priceId: '' });

    expect(invalidTypeResponse.status).toBe(400);
    expect(invalidTypeResponse.body.error).toBe('Invalid priceId');

    const unknownPriceResponse = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .send({ priceId: 'price_unknown' });

    expect(unknownPriceResponse.status).toBe(400);
    expect(unknownPriceResponse.body.error).toBe('Unknown priceId');
  });

  it('POST /api/payment/checkout returns 500 when checkout return URL is unavailable', async () => {
    const previousFrontendUrlForTest = process.env.FRONTEND_URL;
    delete process.env.FRONTEND_URL;

    try {
      const response = await request(app)
        .post('/api/payment/checkout')
        .set('x-api-key', TEST_API_KEY)
        .send({ priceId: 'price_explorer_monthly' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Billing return URL is not configured');
    } finally {
      if (previousFrontendUrlForTest === undefined) {
        delete process.env.FRONTEND_URL;
      } else {
        process.env.FRONTEND_URL = previousFrontendUrlForTest;
      }
    }
  });

  it('POST /api/payment/checkout creates a customer and returns a checkout URL', async () => {
    const response = await request(app)
      .post('/api/payment/checkout')
      .set('x-api-key', TEST_API_KEY)
      .set('Origin', TEST_ALLOWED_ORIGIN)
      .send({ priceId: 'price_explorer_monthly' });

    expect(response.status).toBe(200);
    expect(response.body.url).toBe('https://checkout.stripe.com/pay/cs_test_123');
    expect(paymentServiceMock.createCustomer).toHaveBeenCalledWith(TEST_USER_ID);
    expect(billingProfileStoreMock.upsertProfile).toHaveBeenCalledWith(
      TEST_USER_ID,
      expect.objectContaining({
        stripeCustomerId: 'cus_test_123',
        stripeLivemode: false,
      })
    );
    expect(paymentServiceMock.createCheckoutSession).toHaveBeenCalledWith(
      TEST_USER_ID,
      'price_explorer_monthly',
      `${TEST_ALLOWED_ORIGIN}/settings/billing`,
      'cus_test_123'
    );
  });
});
