import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SidebarDataContextProvider } from '@components/ToolSidebar/context';
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

describe('ToolRail gallery toggle', () => {
  it('calls workspace.toggleGallery when gallery button is clicked', () => {
    const toggleGallery = vi.fn();
    render(
      <MemoryRouter>
        <SidebarDataContextProvider
          value={{
            sessions: null,
            promptInteraction: null,
            generation: null,
            assets: null,
            workspace: {
              galleryOpen: false,
              setGalleryOpen: vi.fn(),
              toggleGallery,
            },
          }}
        >
          <ToolRail activePanel="studio" onPanelChange={vi.fn()} user={null} />
        </SidebarDataContextProvider>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    expect(toggleGallery).toHaveBeenCalledTimes(1);
  });

  it('marks gallery button active when gallery is open', () => {
    render(
      <MemoryRouter>
        <SidebarDataContextProvider
          value={{
            sessions: null,
            promptInteraction: null,
            generation: null,
            assets: null,
            workspace: {
              galleryOpen: true,
              setGalleryOpen: vi.fn(),
              toggleGallery: vi.fn(),
            },
          }}
        >
          <ToolRail activePanel="studio" onPanelChange={vi.fn()} user={null} />
        </SidebarDataContextProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'Gallery' }).className).toContain(
      'bg-[#1C1E26]'
    );
  });
});
