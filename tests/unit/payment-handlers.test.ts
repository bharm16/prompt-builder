import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { PaymentError } from '@routes/payment/PaymentError';

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

const createHandlers = (overrides?: {
  paymentService?: Record<string, unknown>;
  billingProfileStore?: Record<string, unknown>;
  userCreditService?: Record<string, unknown>;
}) =>
  createPaymentHandlers({
    paymentService: {
      listInvoices: vi.fn(),
      createBillingPortalSession: vi.fn(),
      isPriceIdConfigured: vi.fn().mockReturnValue(true),
      createCustomer: vi.fn(),
      createCheckoutSession: vi.fn(),
      ...(overrides?.paymentService ?? {}),
    } as never,
    billingProfileStore: {
      getProfile: vi.fn().mockResolvedValue(null),
      upsertProfile: vi.fn(),
      ...(overrides?.billingProfileStore ?? {}),
    } as never,
    userCreditService: {
      getStarterGrantInfo: vi.fn().mockResolvedValue({
        starterGrantCredits: null,
        starterGrantGrantedAtMs: null,
      }),
      listCreditTransactions: vi.fn().mockResolvedValue([]),
      ...(overrides?.userCreditService ?? {}),
    } as never,
  });

describe('createPaymentHandlers', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  describe('getStatus', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createHandlers();
      const req = {} as Request;
      const res = createRes();

      await handlers.getStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns billing status payload', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createHandlers({
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({
            planTier: 'explorer',
            stripeSubscriptionId: 'sub_1',
          }),
        },
        userCreditService: {
          getStarterGrantInfo: vi.fn().mockResolvedValue({
            starterGrantCredits: 25,
            starterGrantGrantedAtMs: 123,
          }),
        },
      });
      const req = {} as Request;
      const res = createRes();

      await handlers.getStatus(req, res);

      expect(res.json).toHaveBeenCalledWith({
        planTier: 'explorer',
        isSubscribed: true,
        starterGrantCredits: 25,
        starterGrantGrantedAtMs: 123,
      });
    });
  });

  describe('listCreditHistory', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createHandlers();
      const req = {} as Request;
      const res = createRes();

      await handlers.listCreditHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns transactions with clamped limit', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const listCreditTransactions = vi.fn().mockResolvedValue([
        {
          id: 'txn_1',
          type: 'add',
          amount: 25,
          source: 'starter-grant',
          reason: null,
          referenceId: null,
          createdAtMs: 123,
        },
      ]);
      const handlers = createHandlers({
        userCreditService: {
          listCreditTransactions,
        },
      });
      const req = {
        query: {
          limit: '1000',
        },
      } as unknown as Request;
      const res = createRes();

      await handlers.listCreditHistory(req, res);

      expect(listCreditTransactions).toHaveBeenCalledWith('user-1', 100);
      expect(res.json).toHaveBeenCalledWith({
        transactions: [
          {
            id: 'txn_1',
            type: 'add',
            amount: 25,
            source: 'starter-grant',
            reason: null,
            referenceId: null,
            createdAtMs: 123,
          },
        ],
      });
    });
  });

  describe('listInvoices', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createHandlers();
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('returns empty invoices when billing profile has no customer', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createHandlers();
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(res.json).toHaveBeenCalledWith({ invoices: [] });
    });

    it('maps and returns invoices from payment service', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const listInvoices = vi.fn().mockResolvedValue([
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
      ]);
      const handlers = createHandlers({
        paymentService: {
          listInvoices,
        },
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        },
      });
      const req = {} as Request;
      const res = createRes();

      await handlers.listInvoices(req, res);

      expect(listInvoices).toHaveBeenCalledWith('cus_1', 20);
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
      const handlers = createHandlers();
      const req = { headers: {} } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    });

    it('throws PaymentError when user has no billing profile', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createHandlers({
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({}),
        },
      });
      const req = { headers: {} } as Request;
      const res = createRes();

      await expect(handlers.createPortalSession(req, res)).rejects.toThrow(PaymentError);
      await expect(handlers.createPortalSession(req, res)).rejects.toThrow('No billing profile found');
    });

    it('creates portal session when customer exists', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const createBillingPortalSession = vi
        .fn()
        .mockResolvedValue({ url: 'https://portal.example.com' });
      const handlers = createHandlers({
        paymentService: {
          createBillingPortalSession,
        },
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue({ stripeCustomerId: 'cus_1' }),
        },
      });
      const req = { headers: { origin: 'https://app.example.com' } } as Request;
      const res = createRes();

      await handlers.createPortalSession(req, res);

      expect(createBillingPortalSession).toHaveBeenCalledWith(
        'cus_1',
        'https://app.example.com/settings/billing'
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://portal.example.com' });
    });
  });

  describe('createCheckoutSession', () => {
    it('returns 401 when user cannot be resolved', async () => {
      mocks.resolveUserId.mockResolvedValue(null);
      const handlers = createHandlers();
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
      const handlers = createHandlers();
      const req = {
        body: { priceId: '   ' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid priceId' });
    });

    it('throws PaymentError for unknown priceId', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const handlers = createHandlers({
        paymentService: {
          isPriceIdConfigured: vi.fn().mockReturnValue(false),
        },
      });
      const req = {
        body: { priceId: 'price_unknown' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await expect(handlers.createCheckoutSession(req, res)).rejects.toThrow(PaymentError);
      await expect(handlers.createCheckoutSession(req, res)).rejects.toThrow('Unknown priceId');
    });

    it('creates customer when billing profile is missing and persists it', async () => {
      mocks.resolveUserId.mockResolvedValue('user-1');
      const createCustomer = vi.fn().mockResolvedValue({ id: 'cus_new', livemode: false });
      const createCheckoutSession = vi
        .fn()
        .mockResolvedValue({ url: 'https://checkout.example.com' });
      const upsertProfile = vi.fn().mockResolvedValue(undefined);
      const handlers = createHandlers({
        paymentService: {
          createCustomer,
          createCheckoutSession,
        },
        billingProfileStore: {
          getProfile: vi.fn().mockResolvedValue(null),
          upsertProfile,
        },
      });
      const req = {
        body: { priceId: 'price_valid' },
        headers: { origin: 'https://app.example.com' },
      } as Request;
      const res = createRes();

      await handlers.createCheckoutSession(req, res);

      expect(createCustomer).toHaveBeenCalledWith('user-1');
      expect(upsertProfile).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_new',
        stripeLivemode: false,
      });
      expect(createCheckoutSession).toHaveBeenCalledWith(
        'user-1',
        'price_valid',
        'https://app.example.com/settings/billing',
        'cus_new'
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://checkout.example.com' });
    });
  });
});
