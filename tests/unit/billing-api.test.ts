import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
}));

vi.mock('@/services/ApiClient', () => ({
  apiClient: {
    post: mocks.post,
    get: mocks.get,
  },
}));

import {
  createBillingPortalSession,
  createCheckoutSession,
  fetchBillingStatus,
  fetchCreditHistory,
  fetchInvoices,
} from '@/api/billingApi';

describe('billingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('posts checkout request and returns parsed session URL', async () => {
    mocks.post.mockResolvedValue({ url: 'https://checkout.example.com' });

    const result = await createCheckoutSession('price_123');

    expect(mocks.post).toHaveBeenCalledWith('/api/payment/checkout', { priceId: 'price_123' });
    expect(result).toEqual({ url: 'https://checkout.example.com' });
  });

  it('posts portal request and returns parsed URL', async () => {
    mocks.post.mockResolvedValue({ url: 'https://portal.example.com' });

    const result = await createBillingPortalSession();

    expect(mocks.post).toHaveBeenCalledWith('/api/payment/portal', {});
    expect(result).toEqual({ url: 'https://portal.example.com' });
  });

  it('gets invoices and returns parsed invoice summaries', async () => {
    mocks.get.mockResolvedValue({
      invoices: [
        {
          id: 'inv_1',
          number: '1001',
          status: 'paid',
          created: 123,
          currency: 'usd',
          amountDue: 1000,
          amountPaid: 1000,
          hostedInvoiceUrl: 'https://invoice.example.com/1',
          invoicePdf: 'https://invoice.example.com/1.pdf',
        },
      ],
    });

    const invoices = await fetchInvoices();

    expect(mocks.get).toHaveBeenCalledWith('/api/payment/invoices');
    expect(invoices).toHaveLength(1);
    expect(invoices[0]).toMatchObject({
      id: 'inv_1',
      status: 'paid',
    });
  });

  it('throws when checkout response schema is invalid', async () => {
    mocks.post.mockResolvedValue({ url: 'not-a-url' });

    await expect(createCheckoutSession('price_123')).rejects.toThrow();
  });

  it('throws when invoice response schema is invalid', async () => {
    mocks.get.mockResolvedValue({
      invoices: [
        {
          id: 'inv_1',
          number: null,
        },
      ],
    });

    await expect(fetchInvoices()).rejects.toThrow();
  });

  it('gets billing status and validates schema', async () => {
    mocks.get.mockResolvedValue({
      planTier: 'explorer',
      isSubscribed: true,
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });

    const status = await fetchBillingStatus();

    expect(mocks.get).toHaveBeenCalledWith('/api/payment/status');
    expect(status).toEqual({
      planTier: 'explorer',
      isSubscribed: true,
      starterGrantCredits: 25,
      starterGrantGrantedAtMs: 1700000000000,
    });
  });

  it('gets credit history with limit and validates schema', async () => {
    mocks.get.mockResolvedValue({
      transactions: [
        {
          id: 'txn_1',
          type: 'add',
          amount: 25,
          source: 'starter-grant',
          reason: null,
          referenceId: null,
          createdAtMs: 1700000000000,
        },
      ],
    });

    const history = await fetchCreditHistory(10);

    expect(mocks.get).toHaveBeenCalledWith('/api/payment/credits/history?limit=10');
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe('txn_1');
  });
});
