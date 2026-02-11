import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  resolveUserId: vi.fn(),
  loggerError: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('@routes/payment/auth', () => ({
  resolveUserId: mocks.resolveUserId,
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    error: mocks.loggerError,
    warn: mocks.loggerWarn,
  },
}));

import { createPaymentHandlers } from '@routes/payment/handlers';

const createRes = (): Response =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }) as unknown as Response;

describe('createPaymentHandlers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('listInvoices', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createPaymentHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
      });
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns empty invoices when billing profile has no customer', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createPaymentHandlers({
        paymentService: {
          listInvoices: vi.fn(),
        } as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue(null),
        } as never,
      });
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(res.json).toHaveBeenCalledWith({ invoices: [] });
    });

    it('maps and returns invoices from payment service', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const paymentService = {
        listInvoices: vi.fn().mockResolvedValue([
          {
            id: 'inv_1',
            number: '1001',
            status: 'paid',
            created: 123,
            currency: 'usd',
            amount_due: 1500,
            amount_paid: 1500,
            hosted_invoice_url: 'https://invoice.example.com/1',
            invoice_pdf: 'https://invoice.example.com/1.pdf',
          },
        ]),
      };
      const handlers = createPaymentHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        } as never,
      });
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(paymentService.listInvoices).toHaveBeenCalledWith('cus_1', 20);
      expect(res.json).toHaveBeenCalledWith({
        invoices: [
          {
            id: 'inv_1',
            number: '1001',
            status: 'paid',
            created: 123,
            currency: 'usd',
            amountDue: 1500,
            amountPaid: 1500,
            hostedInvoiceUrl: 'https://invoice.example.com/1',
            invoicePdf: 'https://invoice.example.com/1.pdf',
          },
        ],
      });
    });
  });

  describe('createPortalSession', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createPaymentHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
      });
      const req = { headers: {} } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns 400 when user has no billing profile', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createPaymentHandlers({
        paymentService: {} as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({}),
        } as never,
      });
      const req = { headers: {} } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'No billing profile found' });
    });

    it('returns 500 when origin and FRONTEND_URL are missing', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      delete process.env.FRONTEND_URL;
      const handlers = createPaymentHandlers({
        paymentService: {} as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        } as never,
      });
      const req = { headers: {} } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Billing return URL is not configured' });
    });

    it('creates portal session when customer exists', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const paymentService = {
        createBillingPortalSession: vi.fn().mockResolvedValue({ url: 'https://portal.example.com' }),
      };
      const handlers = createPaymentHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        } as never,
      });
      const req = { headers: { origin: 'https://app.example.com' } } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(paymentService.createBillingPortalSession).toHaveBeenCalledWith(
        'cus_1',
        'https://app.example.com/settings/billing'
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://portal.example.com' });
    });
  });

  describe('createCheckoutSession', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createPaymentHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns 400 for invalid priceId payload', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createPaymentHandlers({
        paymentService: {
          isPriceIdConfigured: vi.fn(),
        } as never,
        billingProfileStore: {} as never,
      });
      const req = {
        body: { priceId: '   ' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid priceId' });
    });

    it('returns 500 when origin and FRONTEND_URL are missing', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      delete process.env.FRONTEND_URL;
      const handlers = createPaymentHandlers({
        paymentService: {
          isPriceIdConfigured: vi.fn().mockReturnValue(true),
        } as never,
        billingProfileStore: {} as never,
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: {},
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Billing return URL is not configured' });
    });

    it('validates priceId and returns 400 for unknown price', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createPaymentHandlers({
        paymentService: {
          isPriceIdConfigured: vi.fn().mockReturnValue(false),
        } as never,
        billingProfileStore: {} as never,
      });
      const req = {
        body: { priceId: 'price_unknown' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unknown priceId' });
    });

    it('creates customer when billing profile is missing and persists it', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const paymentService = {
        isPriceIdConfigured: vi.fn().mockReturnValue(true),
        createCustomer: vi.fn().mockResolvedValue({ id: 'cus_new', livemode: false }),
        createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.example.com' }),
      };
      const billingProfileStore = {
        getProfile: vi.fn().mockResolvedValue(null),
        upsertProfile: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createPaymentHandlers({
        paymentService: paymentService as never,
        billingProfileStore: billingProfileStore as never,
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(paymentService.createCustomer).toHaveBeenCalledWith('user-1');
      expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_new',
        stripeLivemode: false,
      });
      expect(paymentService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'price_valid',
        'https://app.example.com/settings/billing',
        'cus_new'
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.example.com' });
    });

    it('continues checkout without stored customer when customer provisioning fails', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const paymentService = {
        isPriceIdConfigured: vi.fn().mockReturnValue(true),
        createCustomer: vi.fn().mockRejectedValue(new Error('customer create failed')),
        createCheckoutSession: vi.fn().mockResolvedValue({ url: 'https://checkout.example.com' }),
      };
      const billingProfileStore = {
        getProfile: vi.fn().mockResolvedValue(null),
        upsertProfile: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createPaymentHandlers({
        paymentService: paymentService as never,
        billingProfileStore: billingProfileStore as never,
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(paymentService.createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'price_valid',
        'https://app.example.com/settings/billing',
        undefined
      );
      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Failed to ensure Stripe customer; checkout will create one automatically',
        expect.objectContaining({
          userId: 'user-1',
          error: 'customer create failed',
        })
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.example.com' });
    });

    it('returns 500 when checkout session creation fails', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const paymentService = {
        isPriceIdConfigured: vi.fn().mockReturnValue(true),
        createCustomer: vi.fn().mockResolvedValue({ id: 'cus_new', livemode: false }),
        createCheckoutSession: vi.fn().mockRejectedValue(new Error('stripe unavailable')),
      };
      const handlers = createPaymentHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue(null),
          upsertProfile: vi.fn().mockResolvedValue(undefined),
        } as never,
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: 'Failed to create checkout session' });
    });
  });
});
