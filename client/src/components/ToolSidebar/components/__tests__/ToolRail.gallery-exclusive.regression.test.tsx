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

describe('regression: nav rail buttons never show active/selected state', () => {
  it('no nav button shows active styling regardless of activePanel value', () => {
    render(
      <MemoryRouter>
        <ToolRail activePanel="studio" onPanelChange={vi.fn()} user={null} />
      </MemoryRouter>
    );

    const toolButton = screen.getByRole('button', { name: 'Tool' });
    const galleryButton = screen.getByRole('button', { name: 'Gallery' });
    const sessionsButton = screen.getByRole('button', { name: 'Sessions' });

    expect(toolButton.className).not.toContain('bg-tool-nav-active');
    expect(galleryButton.className).not.toContain('bg-tool-nav-active');
    expect(sessionsButton.className).not.toContain('bg-tool-nav-active');
  });

  it('Gallery button is inert — no-op on click', () => {
    const onPanelChange = vi.fn();

    render(
      <MemoryRouter>
        <ToolRail activePanel="studio" onPanelChange={onPanelChange} user={null} />
      </MemoryRouter>
    );

    const galleryButton = screen.getByRole('button', { name: 'Gallery' });
    galleryButton.click();

    // Gallery click should not trigger panel change
    expect(onPanelChange).not.toHaveBeenCalled();
  });
});
