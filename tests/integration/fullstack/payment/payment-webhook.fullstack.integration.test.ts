import type { Application } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureServices, initializeServices } from '@config/services.config';
import { createApp } from '@server/app';

const {
  paymentServiceMock,
  webhookEventStoreMock,
  billingProfileStoreMock,
  userCreditServiceMock,
  paymentConsistencyStoreMock,
} = vi.hoisted(() => {
  const paymentServiceMock = {
    constructEvent: vi.fn(),
    resolveUserIdForInvoice: vi.fn(),
    calculateCreditsForInvoice: vi.fn(),
    listInvoices: vi.fn(),
    createBillingPortalSession: vi.fn(),
    isPriceIdConfigured: vi.fn(),
    createCheckoutSession: vi.fn(),
    createCustomer: vi.fn(),
  };

  const webhookEventStoreMock = {
    claimEvent: vi.fn(),
    markProcessed: vi.fn(),
    markFailed: vi.fn(),
  };

  const billingProfileStoreMock = {
    getProfile: vi.fn(),
    upsertProfile: vi.fn(),
  };

  const userCreditServiceMock = {
    reserveCredits: vi.fn(),
    refundCredits: vi.fn(),
    grantCredits: vi.fn(),
    getBalance: vi.fn(),
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
    webhookEventStoreMock,
    billingProfileStoreMock,
    userCreditServiceMock,
    paymentConsistencyStoreMock,
  };
});

vi.mock('@services/payment/PaymentService', () => ({
  PaymentService: vi.fn(() => paymentServiceMock),
}));

vi.mock('@services/payment/StripeWebhookEventStore', () => ({
  StripeWebhookEventStore: vi.fn(() => webhookEventStoreMock),
}));

vi.mock('@services/payment/BillingProfileStore', () => ({
  BillingProfileStore: vi.fn(() => billingProfileStoreMock),
}));

vi.mock('@services/payment/PaymentConsistencyStore', () => ({
  PaymentConsistencyStore: vi.fn(() => paymentConsistencyStoreMock),
}));

vi.mock('@services/credits/UserCreditService', () => ({
  userCreditService: userCreditServiceMock,
}));

describe('Payment Webhook Route (full-stack integration)', () => {
  let app: Application;

  let previousPort: string | undefined;
  let previousPromptOutputOnly: string | undefined;

  beforeAll(async () => {
    previousPort = process.env.PORT;
    previousPromptOutputOnly = process.env.PROMPT_OUTPUT_ONLY;

    process.env.PORT = '0';
    process.env.PROMPT_OUTPUT_ONLY = 'true';

    const container = await configureServices();
    await initializeServices(container);
    app = createApp(container);
  }, 30_000);

  afterAll(() => {
    if (previousPort === undefined) {
      delete process.env.PORT;
    } else {
      process.env.PORT = previousPort;
    }

    if (previousPromptOutputOnly === undefined) {
      delete process.env.PROMPT_OUTPUT_ONLY;
    } else {
      process.env.PROMPT_OUTPUT_ONLY = previousPromptOutputOnly;
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    webhookEventStoreMock.claimEvent.mockResolvedValue({ state: 'claimed' });
    webhookEventStoreMock.markProcessed.mockResolvedValue(undefined);
    webhookEventStoreMock.markFailed.mockResolvedValue(undefined);

    billingProfileStoreMock.getProfile.mockResolvedValue(null);
    billingProfileStoreMock.upsertProfile.mockResolvedValue(undefined);

    userCreditServiceMock.grantCredits.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.recordUnresolvedEvent.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.getUnresolvedSummary.mockResolvedValue({ openCount: 0, oldestOpenAgeMs: null });
    paymentConsistencyStoreMock.enqueueBillingProfileRepair.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.claimNextBillingProfileRepair.mockResolvedValue(null);
    paymentConsistencyStoreMock.markBillingProfileRepairResolved.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.releaseBillingProfileRepairForRetry.mockResolvedValue(undefined);
    paymentConsistencyStoreMock.markBillingProfileRepairEscalated.mockResolvedValue(undefined);
  });

  it('POST /api/payment/webhook returns 400 when signature header is missing', async () => {
    const response = await request(app)
      .post('/api/payment/webhook')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(400);
    expect(webhookEventStoreMock.claimEvent).not.toHaveBeenCalled();
  });

  it('POST /api/payment/webhook returns 400 when event signature is invalid', async () => {
    paymentServiceMock.constructEvent.mockImplementationOnce(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_invalid')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(400);
    expect(webhookEventStoreMock.claimEvent).not.toHaveBeenCalled();
  });

  it('POST /api/payment/webhook returns 409 when event claim is already in progress', async () => {
    paymentServiceMock.constructEvent.mockReturnValueOnce({
      id: 'evt_claimed',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_claimed',
          mode: 'payment',
          metadata: {
            userId: 'api-key:webhook-user',
            creditAmount: '100',
          },
          customer: 'cus_claimed',
        },
      },
    });

    webhookEventStoreMock.claimEvent.mockResolvedValueOnce({ state: 'in_progress' });

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_claimed')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(409);
    expect(response.body.error).toBeTypeOf('string');
  });

  it('POST /api/payment/webhook returns 500 when claiming event storage fails', async () => {
    paymentServiceMock.constructEvent.mockReturnValueOnce({
      id: 'evt_claim_store_fail',
      type: 'checkout.session.completed',
      livemode: false,
      data: {
        object: {
          id: 'cs_store_fail',
          mode: 'payment',
          metadata: {
            userId: 'api-key:webhook-user',
            creditAmount: '100',
          },
          customer: 'cus_store_fail',
        },
      },
    });

    webhookEventStoreMock.claimEvent.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_store_fail')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(500);
    expect(response.body.error).toBeTypeOf('string');
  });

  it('POST /api/payment/webhook marks events failed when processing throws after claim', async () => {
    paymentServiceMock.constructEvent.mockReturnValueOnce({
      id: 'evt_processing_fail',
      type: 'invoice.paid',
      livemode: false,
      data: {
        object: {
          id: 'in_processing_fail',
          livemode: false,
          customer: 'cus_processing_fail',
          subscription: 'sub_processing_fail',
          amount_paid: 2000,
          lines: {
            data: [],
          },
        },
      },
    });

    webhookEventStoreMock.claimEvent.mockResolvedValueOnce({ state: 'claimed' });
    paymentServiceMock.resolveUserIdForInvoice.mockRejectedValueOnce(new Error('Unable to resolve invoice owner'));

    const response = await request(app)
      .post('/api/payment/webhook')
      .set('stripe-signature', 'sig_processing_fail')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ ok: true })));

    expect(response.status).toBe(500);
    expect(webhookEventStoreMock.markFailed).toHaveBeenCalledWith(
      'evt_processing_fail',
      expect.objectContaining({
        message: expect.stringContaining('Unable to resolve invoice owner'),
      })
    );
    expect(webhookEventStoreMock.markProcessed).not.toHaveBeenCalled();
  });
});
