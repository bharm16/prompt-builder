/**
 * Regression test: Gallery button must close the active panel.
 *
 * When the user opens Styles, then clicks Gallery, both the Styles drawer
 * and Gallery overlay rendered simultaneously. The Gallery button must
 * switch the active panel back to 'studio' to close any open drawer.
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToolRail } from '../ToolRail';

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: () => ({ balance: 10, isLoading: false }),
}));

vi.mock('@/features/billing/hooks/useBillingStatus', () => ({
  useBillingStatus: () => ({ status: { isSubscribed: false }, isLoading: false }),
}));

vi.mock('../../context', () => ({
  useSidebarWorkspaceDomain: () => null,
}));

describe('regression: Gallery button closes active panel', () => {
  it('calls onPanelChange with studio when Gallery is clicked', () => {
    const onPanelChange = vi.fn();
    const onGalleryToggle = vi.fn();

    render(
      <MemoryRouter>
        <ToolRail
          activePanel="styles"
          onPanelChange={onPanelChange}
          onGalleryToggle={onGalleryToggle}
          user={null}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));

    // Gallery must close the active panel by switching to studio
    expect(onPanelChange).toHaveBeenCalledWith('studio');
    expect(onGalleryToggle).toHaveBeenCalledOnce();
  });
});
