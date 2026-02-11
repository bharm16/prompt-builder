import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  stripeConstructor: vi.fn(),
  stripeInstances: [] as Array<Record<string, any>>,
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation((secretKey: string, options: unknown) => {
    mocks.stripeConstructor(secretKey, options);
    const instance = {
      prices: { retrieve: vi.fn() },
      checkout: { sessions: { create: vi.fn() } },
      customers: { create: vi.fn() },
      billingPortal: { sessions: { create: vi.fn() } },
      invoices: { list: vi.fn() },
      subscriptions: { retrieve: vi.fn() },
      webhooks: { constructEvent: vi.fn() },
    };
    mocks.stripeInstances.push(instance);
    return instance;
  }),
}));

import { PaymentService } from '../PaymentService';

const getStripe = (): Record<string, any> => {
  const latest = mocks.stripeInstances.at(-1);
  if (!latest) {
    throw new Error('Missing mocked Stripe instance');
  }
  return latest;
};

describe('PaymentService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stripeInstances.length = 0;
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  describe('price credit mapping', () => {
    it('returns empty mapping when STRIPE_PRICE_CREDITS is missing', () => {
      delete process.env.STRIPE_PRICE_CREDITS;
      const service = new PaymentService();

      expect(service.isPriceIdConfigured('price_a')).toBe(false);
      expect(() => service.getCreditsForPriceId('price_a')).toThrow('Unknown Stripe price ID');
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it('returns empty mapping for invalid JSON', () => {
      process.env.STRIPE_PRICE_CREDITS = '{bad-json';
      const service = new PaymentService();

      expect(service.isPriceIdConfigured('price_a')).toBe(false);
      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Failed to parse STRIPE_PRICE_CREDITS JSON',
        expect.any(Error)
      );
    });

    it('parses valid entries and rejects zero/negative/invalid values', () => {
      process.env.STRIPE_PRICE_CREDITS = JSON.stringify({
        price_valid_string: '10',
        price_valid_float: 12.9,
        price_zero: 0,
        price_negative: -1,
        price_invalid_string: 'abc',
      });

      const service = new PaymentService();

      expect(service.isPriceIdConfigured('price_valid_string')).toBe(true);
      expect(service.isPriceIdConfigured('price_valid_float')).toBe(true);
      expect(service.getCreditsForPriceId('price_valid_string')).toBe(10);
      expect(service.getCreditsForPriceId('price_valid_float')).toBe(12);

      expect(service.isPriceIdConfigured('price_zero')).toBe(false);
      expect(service.isPriceIdConfigured('price_negative')).toBe(false);
      expect(service.isPriceIdConfigured('price_invalid_string')).toBe(false);
    });
  });

  describe('invoice credit resolution', () => {
    it('calculates credits and missing IDs while skipping proration/zero lines', () => {
      process.env.STRIPE_PRICE_CREDITS = JSON.stringify({
        price_a: 10,
        price_b: 5,
      });
      const service = new PaymentService();

      const invoice = {
        lines: {
          data: [
            { price: { id: 'price_a' }, quantity: 2, amount: 1000, proration: false },
            { price: { id: 'price_b' }, amount: 500, proration: false },
            { price: { id: 'price_missing' }, quantity: 1, amount: 100, proration: false },
            { price: { id: 'price_a' }, quantity: 1, amount: 0, proration: false },
            { price: { id: 'price_a' }, quantity: 1, amount: 100, proration: true },
            { price: null, quantity: 1, amount: 100, proration: false },
          ],
        },
      };

      const resolved = service.calculateCreditsForInvoice(invoice as any);

      expect(resolved.credits).toBe(25);
      expect(resolved.missingPriceIds).toEqual(['price_missing']);
    });
  });

  describe('invoice user resolution', () => {
    it('uses invoice.subscription_details metadata first', async () => {
      const service = new PaymentService();
      const resolved = await service.resolveUserIdForInvoice({
        subscription_details: { metadata: { userId: '  user-subscription  ' } },
        lines: { data: [] },
      } as any);

      expect(resolved).toBe('user-subscription');
    });

    it('falls back to line metadata when subscription_details metadata is absent', async () => {
      const service = new PaymentService();
      const resolved = await service.resolveUserIdForInvoice({
        subscription_details: { metadata: {} },
        lines: {
          data: [{ metadata: { userId: 'user-line' } }],
        },
      } as any);

      expect(resolved).toBe('user-line');
    });

    it('fetches subscription metadata when invoice has subscription ID string', async () => {
      const service = new PaymentService();
      const stripe = getStripe();
      stripe.subscriptions.retrieve.mockResolvedValue({
        metadata: { userId: 'user-subscription-fetch' },
      });

      const resolved = await service.resolveUserIdForInvoice({
        subscription_details: { metadata: {} },
        lines: { data: [] },
        subscription: 'sub_123',
      } as any);

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith('sub_123');
      expect(resolved).toBe('user-subscription-fetch');
    });
  });

  describe('checkout and billing operations', () => {
    it('creates checkout session in subscription mode with subscription metadata', async () => {
      process.env.STRIPE_PRICE_CREDITS = JSON.stringify({ price_sub: 500 });
      const service = new PaymentService();
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({ type: 'recurring', recurring: {} });
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.example.com' });

      const session = await service.createCheckoutSession(
        'user-1',
        'price_sub',
        'https://app.example.com',
        'cus_123'
      );

      expect(session).toEqual({ url: 'https://checkout.example.com' });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: 'cus_123',
          mode: 'subscription',
          metadata: expect.objectContaining({
            userId: 'user-1',
            creditAmount: '500',
          }),
          subscription_data: {
            metadata: {
              userId: 'user-1',
            },
          },
        })
      );
    });

    it('creates checkout session in payment mode for one-time prices', async () => {
      process.env.STRIPE_PRICE_CREDITS = JSON.stringify({ price_one_time: 100 });
      const service = new PaymentService();
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({ type: 'one_time', recurring: null });
      stripe.checkout.sessions.create.mockResolvedValue({ url: 'https://checkout.example.com' });

      await service.createCheckoutSession('user-1', 'price_one_time', 'https://app.example.com');

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          metadata: expect.objectContaining({
            creditAmount: '100',
          }),
        })
      );
      expect(stripe.checkout.sessions.create.mock.calls[0][0]).not.toHaveProperty('subscription_data');
    });

    it('throws when checkout session URL is missing', async () => {
      process.env.STRIPE_PRICE_CREDITS = JSON.stringify({ price_sub: 500 });
      const service = new PaymentService();
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({ type: 'recurring', recurring: {} });
      stripe.checkout.sessions.create.mockResolvedValue({});

      await expect(
        service.createCheckoutSession('user-1', 'price_sub', 'https://app.example.com')
      ).rejects.toThrow('Stripe session URL was not generated');
    });

    it('creates billing portal session and lists invoices', async () => {
      const service = new PaymentService();
      const stripe = getStripe();
      stripe.billingPortal.sessions.create.mockResolvedValue({ url: 'https://portal.example.com' });
      stripe.invoices.list.mockResolvedValue({
        data: [{ id: 'inv_1' }, { id: 'inv_2' }],
      });

      await expect(
        service.createBillingPortalSession('cus_123', 'https://app.example.com/settings/billing')
      ).resolves.toEqual({ url: 'https://portal.example.com' });
      await expect(service.listInvoices('cus_123', 2)).resolves.toEqual([
        { id: 'inv_1' },
        { id: 'inv_2' },
      ]);
    });
  });

  describe('webhook event construction', () => {
    it('throws when webhook secret is missing', () => {
      const service = new PaymentService();
      delete process.env.STRIPE_WEBHOOK_SECRET;

      expect(() => service.constructEvent('payload', 'signature')).toThrow(
        'STRIPE_WEBHOOK_SECRET is not configured'
      );
    });

    it('constructs event with configured webhook secret', () => {
      const service = new PaymentService();
      const stripe = getStripe();
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
      const event = { id: 'evt_1', type: 'invoice.paid' };
      stripe.webhooks.constructEvent.mockReturnValue(event);

      const result = service.constructEvent('payload', 'signature');

      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'whsec_123'
      );
      expect(result).toBe(event);
    });
  });
});
