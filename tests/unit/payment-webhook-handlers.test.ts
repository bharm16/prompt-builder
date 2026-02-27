import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@infrastructure/Logger', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

import { createWebhookEventHandlers } from '@routes/payment/webhook/handlers';

describe('createWebhookEventHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleCheckoutSessionCompleted', () => {
    it('persists subscription checkout billing profile and does not directly grant credits', async () => {
      const billingProfileStore = {
        upsertProfile: vi.fn().mockResolvedValue(undefined),
      };
      const userCreditService = {
        addCredits: vi.fn(),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: {} as never,
        billingProfileStore: billingProfileStore as never,
        userCreditService: userCreditService as never,
      });

      await handlers.handleCheckoutSessionCompleted({
        id: 'cs_1',
        mode: 'subscription',
        livemode: false,
        metadata: { userId: 'user-1' },
        customer: 'cus_1',
        subscription: 'sub_1',
      } as any, 'evt_sub_1');

      expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        stripeLivemode: false,
      });
      expect(userCreditService.addCredits).not.toHaveBeenCalled();
    });

    it('logs and continues when subscription profile persistence fails', async () => {
      const billingProfileStore = {
        upsertProfile: vi.fn().mockRejectedValue(new Error('db down')),
      };
      const paymentConsistencyStore = {
        enqueueBillingProfileRepair: vi.fn().mockResolvedValue(undefined),
      };
      const metricsService = {
        recordAlert: vi.fn(),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: {} as never,
        billingProfileStore: billingProfileStore as never,
        userCreditService: {} as never,
        paymentConsistencyStore: paymentConsistencyStore as never,
        metricsService: metricsService as never,
      });

      await handlers.handleCheckoutSessionCompleted({
        id: 'cs_1',
        mode: 'subscription',
        livemode: false,
        metadata: { userId: 'user-1' },
        customer: 'cus_1',
        subscription: 'sub_1',
      } as any, 'evt_sub_2');

      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Failed to persist billing profile from checkout',
        expect.any(Error),
        expect.objectContaining({
          userId: 'user-1',
          sessionId: 'cs_1',
        })
      );
      expect(paymentConsistencyStore.enqueueBillingProfileRepair).toHaveBeenCalledWith(
        expect.objectContaining({
          repairKey: 'checkout:cs_1',
          source: 'checkout',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          referenceId: 'cs_1',
          eventId: 'evt_sub_2',
        })
      );
      expect(metricsService.recordAlert).toHaveBeenCalledWith(
        'billing_profile_repair_queued',
        expect.objectContaining({
          source: 'checkout',
          userId: 'user-1',
          referenceId: 'cs_1',
          eventId: 'evt_sub_2',
        })
      );
    });

    it('grants credits for one-time checkout sessions with valid metadata', async () => {
      const userCreditService = {
        addCredits: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
        userCreditService: userCreditService as never,
      });

      await handlers.handleCheckoutSessionCompleted({
        id: 'cs_2',
        mode: 'payment',
        metadata: {
          userId: 'user-2',
          creditAmount: '120',
        },
        client_reference_id: null,
      } as any, 'evt_pay_1');

      expect(userCreditService.addCredits).toHaveBeenCalledWith('user-2', 120, {
        source: 'stripe_checkout',
        reason: 'one_time_credit_pack',
        referenceId: 'cs_2',
      });
    });

    it('quarantines one-time checkout when credit metadata is invalid', async () => {
      const userCreditService = {
        addCredits: vi.fn(),
      };
      const paymentConsistencyStore = {
        recordUnresolvedEvent: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
        userCreditService: userCreditService as never,
        paymentConsistencyStore: paymentConsistencyStore as never,
      });

      await expect(
        handlers.handleCheckoutSessionCompleted(
          {
            id: 'cs_3',
            mode: 'payment',
            livemode: false,
            metadata: {
              userId: 'user-3',
              creditAmount: '0',
            },
          } as any,
          'evt_pay_bad_1'
        )
      ).rejects.toThrow('Checkout session missing credit metadata');

      expect(userCreditService.addCredits).not.toHaveBeenCalled();
      expect(paymentConsistencyStore.recordUnresolvedEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_pay_bad_1',
          eventType: 'checkout.session.completed',
          stripeObjectId: 'cs_3',
        })
      );
    });
  });

  describe('handleInvoicePaid', () => {
    it('quarantines invoice.paid when user cannot be resolved', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue(null),
      };
      const paymentConsistencyStore = {
        recordUnresolvedEvent: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: {} as never,
        paymentConsistencyStore: paymentConsistencyStore as never,
      });

      await expect(
        handlers.handleInvoicePaid(
          {
            id: 'in_1',
            lines: { data: [] },
            livemode: false,
          } as any,
          'evt_1'
        )
      ).rejects.toThrow('Invoice paid without user metadata');

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        'Invoice paid without user metadata',
        expect.objectContaining({
          invoiceId: 'in_1',
          eventId: 'evt_1',
        })
      );
      expect(paymentConsistencyStore.recordUnresolvedEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: 'evt_1',
          eventType: 'invoice.paid',
          stripeObjectId: 'in_1',
        })
      );
    });

    it('skips credit grant for zero-amount paid invoices', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue('user-1'),
        calculateCreditsForInvoice: vi.fn().mockReturnValue({ credits: 100, missingPriceIds: [] }),
      };
      const userCreditService = {
        addCredits: vi.fn(),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: userCreditService as never,
      });

      await handlers.handleInvoicePaid(
        {
          id: 'in_2',
          amount_paid: 0,
          lines: { data: [] },
          livemode: false,
        } as any,
        'evt_2'
      );

      expect(userCreditService.addCredits).not.toHaveBeenCalled();
    });

    it('throws when invoice includes unmapped price IDs', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue('user-1'),
        calculateCreditsForInvoice: vi
          .fn()
          .mockReturnValue({ credits: 100, missingPriceIds: ['price_missing'] }),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: {} as never,
      });

      await expect(
        handlers.handleInvoicePaid(
          {
            id: 'in_3',
            amount_paid: 1000,
            lines: { data: [] },
            livemode: false,
          } as any,
          'evt_3'
        )
      ).rejects.toThrow('missing credit mapping');
    });

    it('throws when credits resolve to zero for paid invoice', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue('user-1'),
        calculateCreditsForInvoice: vi.fn().mockReturnValue({ credits: 0, missingPriceIds: [] }),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: {} as never,
      });

      await expect(
        handlers.handleInvoicePaid(
          {
            id: 'in_4',
            amount_paid: 1000,
            lines: { data: [] },
            livemode: false,
          } as any,
          'evt_4'
        )
      ).rejects.toThrow('paid but credits resolved to 0');
    });

    it('persists billing profile and grants credits on successful invoice payment', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue('user-1'),
        calculateCreditsForInvoice: vi.fn().mockReturnValue({ credits: 250, missingPriceIds: [] }),
      };
      const billingProfileStore = {
        upsertProfile: vi.fn().mockResolvedValue(undefined),
      };
      const userCreditService = {
        addCredits: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: billingProfileStore as never,
        userCreditService: userCreditService as never,
      });

      await handlers.handleInvoicePaid(
        {
          id: 'in_5',
          amount_paid: 1000,
          customer: 'cus_1',
          subscription: 'sub_1',
          lines: {
            data: [{ price: { id: 'price_creator_monthly' } }],
          },
          livemode: false,
        } as any,
        'evt_5'
      );

      expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith('user-1', {
        stripeCustomerId: 'cus_1',
        stripeSubscriptionId: 'sub_1',
        planTier: 'creator',
        subscriptionPriceId: 'price_creator_monthly',
        stripeLivemode: false,
      });
      expect(userCreditService.addCredits).toHaveBeenCalledWith('user-1', 250, {
        source: 'stripe_invoice',
        reason: 'subscription_invoice_paid',
        referenceId: 'in_5',
      });
    });

    it('logs invoice profile persistence error but still grants credits', async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue('user-1'),
        calculateCreditsForInvoice: vi.fn().mockReturnValue({ credits: 250, missingPriceIds: [] }),
      };
      const billingProfileStore = {
        upsertProfile: vi.fn().mockRejectedValue(new Error('db down')),
      };
      const paymentConsistencyStore = {
        enqueueBillingProfileRepair: vi.fn().mockResolvedValue(undefined),
      };
      const metricsService = {
        recordAlert: vi.fn(),
      };
      const userCreditService = {
        addCredits: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: billingProfileStore as never,
        userCreditService: userCreditService as never,
        paymentConsistencyStore: paymentConsistencyStore as never,
        metricsService: metricsService as never,
      });

      await handlers.handleInvoicePaid(
        {
          id: 'in_6',
          amount_paid: 1000,
          customer: 'cus_1',
          subscription: 'sub_1',
          lines: {
            data: [{ price: { id: 'price_creator_monthly' } }],
          },
          livemode: false,
        } as any,
        'evt_6'
      );

      expect(mocks.loggerError).toHaveBeenCalledWith(
        'Failed to persist billing profile from invoice',
        expect.any(Error),
        expect.objectContaining({
          userId: 'user-1',
          invoiceId: 'in_6',
          eventId: 'evt_6',
        })
      );
      expect(paymentConsistencyStore.enqueueBillingProfileRepair).toHaveBeenCalledWith(
        expect.objectContaining({
          repairKey: 'invoice:in_6',
          source: 'invoice',
          userId: 'user-1',
          stripeCustomerId: 'cus_1',
          stripeSubscriptionId: 'sub_1',
          referenceId: 'in_6',
          eventId: 'evt_6',
        })
      );
      expect(metricsService.recordAlert).toHaveBeenCalledWith(
        'billing_profile_repair_queued',
        expect.objectContaining({
          source: 'invoice',
          userId: 'user-1',
          referenceId: 'in_6',
          eventId: 'evt_6',
        })
      );
      expect(userCreditService.addCredits).toHaveBeenCalledWith('user-1', 250, {
        source: 'stripe_invoice',
        reason: 'subscription_invoice_paid',
        referenceId: 'in_6',
      });
    });
  });
});
