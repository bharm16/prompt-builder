import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  stripeConstructor: vi.fn(),
  stripeInstances: [] as Array<Record<string, any>>,
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@infrastructure/Logger", () => ({
  logger: {
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  },
}));

vi.mock("stripe", () => ({
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

import { PaymentService } from "../PaymentService";
import type { PaymentInvoice } from "../types";

const getStripe = (): Record<string, any> => {
  const latest = mocks.stripeInstances.at(-1);
  if (!latest) {
    throw new Error("Missing mocked Stripe instance");
  }
  return latest;
};

const buildPaymentInvoice = (
  overrides: Partial<PaymentInvoice> = {},
): PaymentInvoice => ({
  id: "inv_test",
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

describe("PaymentService", () => {
  const baseConfig = {
    secretKey: "sk_test_123",
    webhookSecret: "whsec_123",
    priceCreditsJson: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stripeInstances.length = 0;
  });

  describe("price credit mapping", () => {
    it("returns empty mapping when priceCreditsJson is missing", () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: undefined,
      });

      expect(service.isPriceIdConfigured("price_a")).toBe(false);
      expect(() => service.getCreditsForPriceId("price_a")).toThrow(
        "Unknown Stripe price ID",
      );
      expect(mocks.loggerWarn).toHaveBeenCalled();
    });

    it("returns empty mapping for invalid JSON", () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: "{bad-json",
      });

      expect(service.isPriceIdConfigured("price_a")).toBe(false);
      expect(mocks.loggerError).toHaveBeenCalledWith(
        "Failed to parse STRIPE_PRICE_CREDITS JSON",
        expect.any(Error),
      );
    });

    it("parses valid entries and rejects zero/negative/invalid values", () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: JSON.stringify({
          price_valid_string: "10",
          price_valid_float: 12.9,
          price_zero: 0,
          price_negative: -1,
          price_invalid_string: "abc",
        }),
      });

      expect(service.isPriceIdConfigured("price_valid_string")).toBe(true);
      expect(service.isPriceIdConfigured("price_valid_float")).toBe(true);
      expect(service.getCreditsForPriceId("price_valid_string")).toBe(10);
      expect(service.getCreditsForPriceId("price_valid_float")).toBe(12);

      expect(service.isPriceIdConfigured("price_zero")).toBe(false);
      expect(service.isPriceIdConfigured("price_negative")).toBe(false);
      expect(service.isPriceIdConfigured("price_invalid_string")).toBe(false);
    });
  });

  describe("invoice credit resolution", () => {
    it("calculates credits and missing IDs while skipping proration/zero lines", () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: JSON.stringify({ price_a: 10, price_b: 5 }),
      });

      const invoice = buildPaymentInvoice({
        lineItems: [
          {
            priceId: "price_a",
            quantity: 2,
            amount: 1000,
            proration: false,
            metadataUserId: null,
          },
          {
            priceId: "price_b",
            quantity: null,
            amount: 500,
            proration: false,
            metadataUserId: null,
          },
          {
            priceId: "price_missing",
            quantity: 1,
            amount: 100,
            proration: false,
            metadataUserId: null,
          },
          {
            priceId: "price_a",
            quantity: 1,
            amount: 0,
            proration: false,
            metadataUserId: null,
          },
          {
            priceId: "price_a",
            quantity: 1,
            amount: 100,
            proration: true,
            metadataUserId: null,
          },
          {
            priceId: null,
            quantity: 1,
            amount: 100,
            proration: false,
            metadataUserId: null,
          },
        ],
      });

      const resolved = service.calculateCreditsForInvoice(invoice);

      expect(resolved.credits).toBe(25);
      expect(resolved.missingPriceIds).toEqual(["price_missing"]);
    });
  });

  describe("invoice user resolution", () => {
    it("uses subscription details user id first", async () => {
      const service = new PaymentService(baseConfig);
      const resolved = await service.resolveUserIdForInvoice(
        buildPaymentInvoice({
          subscriptionDetailsUserId: "user-subscription",
        }),
      );

      expect(resolved).toBe("user-subscription");
    });

    it("falls back to line metadata user id when subscription details user id is absent", async () => {
      const service = new PaymentService(baseConfig);
      const resolved = await service.resolveUserIdForInvoice(
        buildPaymentInvoice({
          lineItems: [
            {
              priceId: null,
              quantity: null,
              amount: null,
              proration: false,
              metadataUserId: "user-line",
            },
          ],
        }),
      );

      expect(resolved).toBe("user-line");
    });

    it("fetches subscription metadata when only subscription id is set", async () => {
      const service = new PaymentService(baseConfig);
      const stripe = getStripe();
      stripe.subscriptions.retrieve.mockResolvedValue({
        metadata: { userId: "user-subscription-fetch" },
      });

      const resolved = await service.resolveUserIdForInvoice(
        buildPaymentInvoice({
          subscriptionId: "sub_123",
        }),
      );

      expect(stripe.subscriptions.retrieve).toHaveBeenCalledWith("sub_123");
      expect(resolved).toBe("user-subscription-fetch");
    });
  });

  describe("checkout and billing operations", () => {
    it("creates checkout session in subscription mode with subscription metadata", async () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: JSON.stringify({ price_sub: 500 }),
      });
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({
        type: "recurring",
        recurring: {},
      });
      stripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.example.com",
      });

      const session = await service.createCheckoutSession(
        "user-1",
        "price_sub",
        "https://app.example.com",
        "cus_123",
      );

      expect(session).toEqual({ url: "https://checkout.example.com" });
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customer: "cus_123",
          mode: "subscription",
          metadata: expect.objectContaining({
            userId: "user-1",
            creditAmount: "500",
          }),
          subscription_data: {
            metadata: {
              userId: "user-1",
            },
          },
        }),
      );
    });

    it("creates checkout session in payment mode for one-time prices", async () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: JSON.stringify({ price_one_time: 100 }),
      });
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({
        type: "one_time",
        recurring: null,
      });
      stripe.checkout.sessions.create.mockResolvedValue({
        url: "https://checkout.example.com",
      });

      await service.createCheckoutSession(
        "user-1",
        "price_one_time",
        "https://app.example.com",
      );

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: "payment",
          metadata: expect.objectContaining({
            creditAmount: "100",
          }),
        }),
      );
      expect(
        stripe.checkout.sessions.create.mock.calls[0][0],
      ).not.toHaveProperty("subscription_data");
    });

    it("throws when checkout session URL is missing", async () => {
      const service = new PaymentService({
        ...baseConfig,
        priceCreditsJson: JSON.stringify({ price_sub: 500 }),
      });
      const stripe = getStripe();
      stripe.prices.retrieve.mockResolvedValue({
        type: "recurring",
        recurring: {},
      });
      stripe.checkout.sessions.create.mockResolvedValue({});

      await expect(
        service.createCheckoutSession(
          "user-1",
          "price_sub",
          "https://app.example.com",
        ),
      ).rejects.toThrow("Stripe session URL was not generated");
    });

    it("creates billing portal session and lists invoices in domain shape", async () => {
      const service = new PaymentService(baseConfig);
      const stripe = getStripe();
      stripe.billingPortal.sessions.create.mockResolvedValue({
        url: "https://portal.example.com",
      });
      stripe.invoices.list.mockResolvedValue({
        data: [
          {
            id: "inv_1",
            number: "VIDRA-1",
            status: "paid",
            created: 1700000000,
            currency: "usd",
            amount_due: 1500,
            amount_paid: 1500,
            hosted_invoice_url: "https://stripe.com/inv_1",
            invoice_pdf: "https://stripe.com/inv_1.pdf",
            livemode: false,
            customer: "cus_1",
            subscription: "sub_1",
            subscription_details: { metadata: { userId: "user-1" } },
            lines: { data: [] },
          },
          {
            id: "inv_2",
            lines: { data: [] },
          },
        ],
      });

      await expect(
        service.createBillingPortalSession(
          "cus_123",
          "https://app.example.com/settings/billing",
        ),
      ).resolves.toEqual({ url: "https://portal.example.com" });

      const invoices = await service.listInvoices("cus_123", 2);
      expect(invoices).toHaveLength(2);
      expect(invoices[0]).toMatchObject({
        id: "inv_1",
        number: "VIDRA-1",
        status: "paid",
        amountDue: 1500,
        amountPaid: 1500,
        hostedInvoiceUrl: "https://stripe.com/inv_1",
        invoicePdf: "https://stripe.com/inv_1.pdf",
        customerId: "cus_1",
        subscriptionId: "sub_1",
        subscriptionDetailsUserId: "user-1",
      });
      expect(invoices[1]).toMatchObject({
        id: "inv_2",
        number: null,
        status: null,
        amountPaid: 0,
      });
    });
  });

  describe("webhook event construction", () => {
    it("throws when webhook secret is missing", () => {
      const service = new PaymentService({
        ...baseConfig,
        webhookSecret: undefined,
      });

      expect(() => service.constructEvent("payload", "signature")).toThrow(
        "STRIPE_WEBHOOK_SECRET is not configured",
      );
    });

    it("converts checkout.session.completed event to domain payload", () => {
      const service = new PaymentService(baseConfig);
      const stripe = getStripe();
      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_1",
        type: "checkout.session.completed",
        livemode: false,
        created: 1700000000,
        data: {
          object: {
            id: "cs_1",
            mode: "subscription",
            livemode: false,
            metadata: { userId: "user-1", creditAmount: "500" },
            client_reference_id: "user-1",
            customer: "cus_1",
            subscription: "sub_1",
          },
        },
      });

      const event = service.constructEvent("payload", "signature");

      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        "payload",
        "signature",
        "whsec_123",
      );
      expect(event).toMatchObject({
        id: "evt_1",
        type: "checkout.session.completed",
        livemode: false,
        payload: {
          id: "cs_1",
          mode: "subscription",
          metadataUserId: "user-1",
          clientReferenceId: "user-1",
          customerId: "cus_1",
          subscriptionId: "sub_1",
          creditAmountMetadata: "500",
        },
      });
    });

    it("converts invoice.paid event to domain payload", () => {
      const service = new PaymentService(baseConfig);
      const stripe = getStripe();
      stripe.webhooks.constructEvent.mockReturnValue({
        id: "evt_2",
        type: "invoice.paid",
        livemode: true,
        created: 1700000001,
        data: {
          object: {
            id: "inv_1",
            amount_paid: 2000,
            livemode: true,
            customer: "cus_1",
            subscription: "sub_1",
            subscription_details: { metadata: { userId: "user-1" } },
            lines: { data: [] },
          },
        },
      });

      const event = service.constructEvent("payload", "signature");

      expect(event).toMatchObject({
        id: "evt_2",
        type: "invoice.paid",
        livemode: true,
        payload: {
          id: "inv_1",
          amountPaid: 2000,
          customerId: "cus_1",
          subscriptionId: "sub_1",
          subscriptionDetailsUserId: "user-1",
        },
      });
    });
  });
});
