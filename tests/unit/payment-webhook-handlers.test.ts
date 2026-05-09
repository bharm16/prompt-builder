import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PaymentCheckoutSession,
  PaymentInvoice,
  PaymentInvoiceLineItem,
} from "@services/payment/types";

const mocks = vi.hoisted(() => ({
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

import { createWebhookEventHandlers } from "@routes/payment/webhook/handlers";

const buildSession = (
  overrides: Partial<PaymentCheckoutSession> = {},
): PaymentCheckoutSession => ({
  id: "cs_default",
  mode: "payment",
  livemode: false,
  metadataUserId: null,
  clientReferenceId: null,
  customerId: null,
  subscriptionId: null,
  creditAmountMetadata: null,
  ...overrides,
});

const buildInvoiceLine = (
  overrides: Partial<PaymentInvoiceLineItem> = {},
): PaymentInvoiceLineItem => ({
  priceId: null,
  quantity: null,
  amount: null,
  proration: false,
  metadataUserId: null,
  ...overrides,
});

const buildInvoice = (
  overrides: Partial<PaymentInvoice> = {},
): PaymentInvoice => ({
  id: "in_default",
  number: null,
  status: null,
  created: null,
  currency: null,
  amountDue: null,
  amountPaid: 0,
  hostedInvoiceUrl: null,
  invoicePdf: null,
  livemode: false,
  customerId: null,
  subscriptionId: null,
  subscriptionDetailsUserId: null,
  lineItems: [],
  ...overrides,
});

describe("createWebhookEventHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleCheckoutSessionCompleted", () => {
    it("persists subscription checkout billing profile and does not directly grant credits", async () => {
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

      await handlers.handleCheckoutSessionCompleted(
        buildSession({
          id: "cs_1",
          mode: "subscription",
          livemode: false,
          metadataUserId: "user-1",
          customerId: "cus_1",
          subscriptionId: "sub_1",
        }),
        "evt_sub_1",
      );

      expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith("user-1", {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        stripeLivemode: false,
      });
      expect(userCreditService.addCredits).not.toHaveBeenCalled();
    });

    it("logs and continues when subscription profile persistence fails", async () => {
      const billingProfileStore = {
        upsertProfile: vi.fn().mockRejectedValue(new Error("db down")),
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

      await handlers.handleCheckoutSessionCompleted(
        buildSession({
          id: "cs_1",
          mode: "subscription",
          livemode: false,
          metadataUserId: "user-1",
          customerId: "cus_1",
          subscriptionId: "sub_1",
        }),
        "evt_sub_2",
      );

      expect(mocks.loggerError).toHaveBeenCalledWith(
        "Failed to persist billing profile from checkout",
        expect.any(Error),
        expect.objectContaining({
          userId: "user-1",
          sessionId: "cs_1",
        }),
      );
      expect(
        paymentConsistencyStore.enqueueBillingProfileRepair,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          repairKey: "checkout:cs_1",
          source: "checkout",
          userId: "user-1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          referenceId: "cs_1",
          eventId: "evt_sub_2",
        }),
      );
      expect(metricsService.recordAlert).toHaveBeenCalledWith(
        "billing_profile_repair_queued",
        expect.objectContaining({
          source: "checkout",
          userId: "user-1",
          referenceId: "cs_1",
          eventId: "evt_sub_2",
        }),
      );
    });

    it("grants credits for one-time checkout sessions with valid metadata", async () => {
      const userCreditService = {
        addCredits: vi.fn().mockResolvedValue(undefined),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: {} as never,
        billingProfileStore: {} as never,
        userCreditService: userCreditService as never,
      });

      await handlers.handleCheckoutSessionCompleted(
        buildSession({
          id: "cs_2",
          mode: "payment",
          metadataUserId: "user-2",
          creditAmountMetadata: "120",
        }),
        "evt_pay_1",
      );

      expect(userCreditService.addCredits).toHaveBeenCalledWith("user-2", 120, {
        source: "stripe_checkout",
        reason: "one_time_credit_pack",
        referenceId: "cs_2",
      });
    });

    it("quarantines one-time checkout when credit metadata is invalid", async () => {
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
          buildSession({
            id: "cs_3",
            mode: "payment",
            livemode: false,
            metadataUserId: "user-3",
            creditAmountMetadata: "0",
          }),
          "evt_pay_bad_1",
        ),
      ).rejects.toThrow("Checkout session missing credit metadata");

      expect(userCreditService.addCredits).not.toHaveBeenCalled();
      expect(
        paymentConsistencyStore.recordUnresolvedEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "evt_pay_bad_1",
          eventType: "checkout.session.completed",
          stripeObjectId: "cs_3",
        }),
      );
    });
  });

  describe("handleInvoicePaid", () => {
    it("quarantines invoice.paid when user cannot be resolved", async () => {
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
          buildInvoice({
            id: "in_1",
            livemode: false,
          }),
          "evt_1",
        ),
      ).rejects.toThrow("Invoice paid without user metadata");

      expect(mocks.loggerWarn).toHaveBeenCalledWith(
        "Invoice paid without user metadata",
        expect.objectContaining({
          invoiceId: "in_1",
          eventId: "evt_1",
        }),
      );
      expect(
        paymentConsistencyStore.recordUnresolvedEvent,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          eventId: "evt_1",
          eventType: "invoice.paid",
          stripeObjectId: "in_1",
        }),
      );
    });

    it("skips credit grant for zero-amount paid invoices", async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue("user-1"),
        calculateCreditsForInvoice: vi
          .fn()
          .mockReturnValue({ credits: 100, missingPriceIds: [] }),
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
        buildInvoice({
          id: "in_2",
          amountPaid: 0,
          livemode: false,
        }),
        "evt_2",
      );

      expect(userCreditService.addCredits).not.toHaveBeenCalled();
    });

    it("throws when invoice includes unmapped price IDs", async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue("user-1"),
        calculateCreditsForInvoice: vi.fn().mockReturnValue({
          credits: 100,
          missingPriceIds: ["price_missing"],
        }),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: {} as never,
      });

      await expect(
        handlers.handleInvoicePaid(
          buildInvoice({
            id: "in_3",
            amountPaid: 1000,
            livemode: false,
          }),
          "evt_3",
        ),
      ).rejects.toThrow("missing credit mapping");
    });

    it("throws when credits resolve to zero for paid invoice", async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue("user-1"),
        calculateCreditsForInvoice: vi
          .fn()
          .mockReturnValue({ credits: 0, missingPriceIds: [] }),
      };
      const handlers = createWebhookEventHandlers({
        paymentService: paymentService as never,
        billingProfileStore: {} as never,
        userCreditService: {} as never,
      });

      await expect(
        handlers.handleInvoicePaid(
          buildInvoice({
            id: "in_4",
            amountPaid: 1000,
            livemode: false,
          }),
          "evt_4",
        ),
      ).rejects.toThrow("paid but credits resolved to 0");
    });

    it("persists billing profile and grants credits on successful invoice payment", async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue("user-1"),
        calculateCreditsForInvoice: vi
          .fn()
          .mockReturnValue({ credits: 250, missingPriceIds: [] }),
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
        buildInvoice({
          id: "in_5",
          amountPaid: 1000,
          customerId: "cus_1",
          subscriptionId: "sub_1",
          lineItems: [buildInvoiceLine({ priceId: "price_creator_monthly" })],
          livemode: false,
        }),
        "evt_5",
      );

      expect(billingProfileStore.upsertProfile).toHaveBeenCalledWith("user-1", {
        stripeCustomerId: "cus_1",
        stripeSubscriptionId: "sub_1",
        planTier: "creator",
        subscriptionPriceId: "price_creator_monthly",
        stripeLivemode: false,
      });
      expect(userCreditService.addCredits).toHaveBeenCalledWith("user-1", 250, {
        source: "stripe_invoice",
        reason: "subscription_invoice_paid",
        referenceId: "in_5",
      });
    });

    it("logs invoice profile persistence error but still grants credits", async () => {
      const paymentService = {
        resolveUserIdForInvoice: vi.fn().mockResolvedValue("user-1"),
        calculateCreditsForInvoice: vi
          .fn()
          .mockReturnValue({ credits: 250, missingPriceIds: [] }),
      };
      const billingProfileStore = {
        upsertProfile: vi.fn().mockRejectedValue(new Error("db down")),
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
        buildInvoice({
          id: "in_6",
          amountPaid: 1000,
          customerId: "cus_1",
          subscriptionId: "sub_1",
          lineItems: [buildInvoiceLine({ priceId: "price_creator_monthly" })],
          livemode: false,
        }),
        "evt_6",
      );

      expect(mocks.loggerError).toHaveBeenCalledWith(
        "Failed to persist billing profile from invoice",
        expect.any(Error),
        expect.objectContaining({
          userId: "user-1",
          invoiceId: "in_6",
          eventId: "evt_6",
        }),
      );
      expect(
        paymentConsistencyStore.enqueueBillingProfileRepair,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          repairKey: "invoice:in_6",
          source: "invoice",
          userId: "user-1",
          stripeCustomerId: "cus_1",
          stripeSubscriptionId: "sub_1",
          referenceId: "in_6",
          eventId: "evt_6",
        }),
      );
      expect(metricsService.recordAlert).toHaveBeenCalledWith(
        "billing_profile_repair_queued",
        expect.objectContaining({
          source: "invoice",
          userId: "user-1",
          referenceId: "in_6",
          eventId: "evt_6",
        }),
      );
      expect(userCreditService.addCredits).toHaveBeenCalledWith("user-1", 250, {
        source: "stripe_invoice",
        reason: "subscription_invoice_paid",
        referenceId: "in_6",
      });
    });
  });
});
