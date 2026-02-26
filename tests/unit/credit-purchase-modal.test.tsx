import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ButtonHTMLAttributes } from 'react';

const mocks = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
}));

vi.mock('@/api/billingApi', () => ({
  createCheckoutSession: mocks.createCheckoutSession,
}));

vi.mock('@promptstudio/system/components/ui/button', () => ({
  Button: ({
    children,
    loading,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) => (
    <button data-loading={loading ? 'true' : 'false'} {...props}>
      {children}
    </button>
  ),
}));

import { CreditPurchaseModal } from '@/features/billing/CreditPurchaseModal';

describe('CreditPurchaseModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders subscription and credit-pack purchase actions', () => {
    render(<CreditPurchaseModal />);

    expect(screen.getByText('Subscriptions')).toBeInTheDocument();
    expect(screen.getByText('Credit packs')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Subscribe' })).toHaveLength(3);
    expect(screen.getAllByRole('button', { name: 'Buy credits' })).toHaveLength(4);
  });

  it('starts checkout for the selected subscription tier', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.example.com',
    });

    render(<CreditPurchaseModal />);
    const subscribeButton = screen.getAllByRole('button', { name: 'Subscribe' })[0]!;
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith('price_explorer_monthly');
    });
    await waitFor(() => {
      expect(subscribeButton).toHaveAttribute('data-loading', 'true');
    });
  });

  it('starts checkout for the selected credit pack', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: 'https://checkout.example.com',
    });

    render(<CreditPurchaseModal />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Buy credits' })[0]!);

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith('price_credits_250');
    });
  });

  it('clears loading state when checkout creation fails', async () => {
    mocks.createCheckoutSession.mockRejectedValue(new Error('stripe unavailable'));

    render(<CreditPurchaseModal />);
    const subscribeButton = screen.getAllByRole('button', { name: 'Subscribe' })[0]!;
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith('price_explorer_monthly');
    });
    await waitFor(() => {
      expect(subscribeButton).toHaveAttribute('data-loading', 'false');
    });
  });

  it('clears loading state when checkout response has no redirect URL', async () => {
    mocks.createCheckoutSession.mockResolvedValue({
      url: '',
    });

    render(<CreditPurchaseModal />);
    const subscribeButton = screen.getAllByRole('button', { name: 'Subscribe' })[0]!;
    fireEvent.click(subscribeButton);

    await waitFor(() => {
      expect(mocks.createCheckoutSession).toHaveBeenCalledWith('price_explorer_monthly');
    });
    await waitFor(() => {
      expect(subscribeButton).toHaveAttribute('data-loading', 'false');
    });
  });
});
