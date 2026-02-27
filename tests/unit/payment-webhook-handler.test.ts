import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  handleCheckoutSessionCompleted: vi.fn(),
  handleInvoicePaid: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() })),
  },
}));

vi.mock('@routes/payment/webhook/handlers', () => ({
  createWebhookEventHandlers: vi.fn(() => ({
    handleCheckoutSessionCompleted: mocks.handleCheckoutSessionCompleted,
    handleInvoicePaid: mocks.handleInvoicePaid,
  })),
}));

import { createStripeWebhookHandler } from '@routes/payment/webhook/handler';

const createRes = (): Response =>
  ({
    setHeader: vi.fn().mockReturnThis(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  }) as unknown as Response;

describe('createStripeWebhookHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const handler = createStripeWebhookHandler({
      paymentService: {} as never,
      webhookEventStore: {} as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: {},
    } as Request;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Missing stripe-signature header');
  });

  it('returns 400 when webhook signature verification fails', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockImplementation(() => {
        throw new Error('bad signature');
      }),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: {} as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Webhook Error: bad signature');
  });

  it('returns duplicate response when event was already processed', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_1',
        type: 'invoice.paid',
        livemode: false,
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockResolvedValue({ state: 'processed' }),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(res.json).toHaveBeenCalledWith({ received: true, duplicate: true });
    expect(mocks.handleInvoicePaid).not.toHaveBeenCalled();
  });

  it('returns 500 when event idempotency claim throws', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_1',
        type: 'invoice.paid',
        livemode: false,
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockRejectedValue(new Error('store down')),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook handling failed' });
  });

  it('returns 503 when Firestore write gate is open before claiming event', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_gate_1',
        type: 'invoice.paid',
        livemode: false,
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn(),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
      firestoreCircuitExecutor: {
        isWriteAllowed: () => false,
        getRetryAfterSeconds: () => 15,
      } as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(webhookEventStore.claimEvent).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Webhook handling deferred while datastore recovers',
    });
  });

  it('returns 409 when duplicate event is currently in progress', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_1',
        type: 'invoice.paid',
        livemode: false,
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockResolvedValue({ state: 'in_progress' }),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      received: false,
      error: 'Webhook event is already processing',
    });
  });

  it('marks event processed after successful checkout.session.completed handling', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_1',
        type: 'checkout.session.completed',
        livemode: false,
        data: { object: { id: 'cs_1' } },
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockResolvedValue({ state: 'claimed' }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(mocks.handleCheckoutSessionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cs_1' }),
      'evt_1'
    );
    expect(webhookEventStore.markProcessed).toHaveBeenCalledWith('evt_1');
    expect(webhookEventStore.markFailed).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });

  it('marks event failed and returns 500 when handler throws', async () => {
    mocks.handleInvoicePaid.mockRejectedValueOnce(new Error('grant failed'));

    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_2',
        type: 'invoice.paid',
        livemode: false,
        data: { object: { id: 'in_1' } },
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockResolvedValue({ state: 'claimed' }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(webhookEventStore.markFailed).toHaveBeenCalledWith('evt_2', expect.any(Error));
    expect(webhookEventStore.markProcessed).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Webhook handling failed' });
  });

  it('marks unhandled webhook event types as processed', async () => {
    const paymentService = {
      constructEvent: vi.fn().mockReturnValue({
        id: 'evt_3',
        type: 'customer.created',
        livemode: false,
        data: { object: { id: 'cus_1' } },
      }),
    };
    const webhookEventStore = {
      claimEvent: vi.fn().mockResolvedValue({ state: 'claimed' }),
      markProcessed: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const handler = createStripeWebhookHandler({
      paymentService: paymentService as never,
      webhookEventStore: webhookEventStore as never,
      billingProfileStore: {} as never,
      userCreditService: {} as never,
    });
    const req = {
      headers: { 'stripe-signature': 'sig_123' },
      body: 'payload',
    } as unknown as Request;
    const res = createRes();

    await handler(req, res);

    expect(webhookEventStore.markProcessed).toHaveBeenCalledWith('evt_3');
    expect(webhookEventStore.markFailed).not.toHaveBeenCalled();
    expect(mocks.handleCheckoutSessionCompleted).not.toHaveBeenCalled();
    expect(mocks.handleInvoicePaid).not.toHaveBeenCalled();
  });
});
