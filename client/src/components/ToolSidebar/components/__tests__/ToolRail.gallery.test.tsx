import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolRail } from '../ToolRail';

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: () => ({
    balance: 10,
    isLoading: false,
  }),
}));

vi.mock('@/features/billing/hooks/useBillingStatus', () => ({
  useBillingStatus: () => ({
    status: { isSubscribed: false },
    isLoading: false,
  }),
}));

vi.mock('../../context', () => ({
  useSidebarWorkspaceDomain: () => null,
}));

describe('ToolRail gallery button', () => {
  it('renders gallery button as inert (no active state)', () => {
    render(
      <MemoryRouter>
        <ToolRail activePanel="studio" onPanelChange={vi.fn()} user={null} />
      </MemoryRouter>
    );

    const galleryButton = screen.getByRole('button', { name: 'Gallery' });
    expect(galleryButton).toBeTruthy();
    expect(galleryButton.className).not.toContain('bg-tool-nav-active');
  }, 30000);
});
