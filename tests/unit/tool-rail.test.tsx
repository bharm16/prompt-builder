import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ToolRail } from '@components/ToolSidebar/components/ToolRail';
import type { User } from '@hooks/types';

vi.mock(
  '@utils/cn',
  () => ({
    cn: (...classes: Array<string | false | null | undefined>) =>
      classes.filter(Boolean).join(' '),
  })
);

const useCreditBalanceMock = vi.hoisted(() => vi.fn());
const useBillingStatusMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/CreditBalanceContext', () => ({
  useCreditBalance: (...args: unknown[]) => useCreditBalanceMock(...args),
}));

vi.mock('@/features/billing/hooks/useBillingStatus', () => ({
  useBillingStatus: (...args: unknown[]) => useBillingStatusMock(...args),
}));

const renderToolRail = (props: { activePanel: Parameters<typeof ToolRail>[0]['activePanel']; user: User | null; onPanelChange: (panel: Parameters<typeof ToolRail>[0]['activePanel']) => void; }) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/studio', search: '?tab=1' }]}>
      <ToolRail {...props} />
    </MemoryRouter>
  );

describe('ToolRail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useCreditBalanceMock.mockReturnValue({
      balance: 12,
      isLoading: false,
      error: null,
    });
    useBillingStatusMock.mockReturnValue({
      status: {
        isSubscribed: false,
        planTier: null,
        starterGrantCredits: 25,
        starterGrantGrantedAtMs: 123,
      },
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });
  });

  describe('error handling', () => {
    it('renders sign-in link with encoded return path for guests', () => {
      renderToolRail({
        activePanel: 'sessions',
        user: null,
        onPanelChange: vi.fn(),
      });

      const link = screen.getByRole('link', { name: 'Sign in' });
      expect(link.getAttribute('href')).toBe(
        `/signin?redirect=${encodeURIComponent('/studio?tab=1')}`
      );
      expect(screen.getByText('U')).toBeInTheDocument();
    });

    it('uses email initial when displayName is empty', () => {
      const user: User = {
        uid: 'user-1',
        email: 'test@example.com',
        displayName: '   ',
      };

      renderToolRail({
        activePanel: 'sessions',
        user,
        onPanelChange: vi.fn(),
      });

      const link = screen.getByRole('link', { name: 'Account' });
      expect(link.getAttribute('href')).toBe('/account');
      expect(screen.getByText('T')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('marks Tool as active when active panel is studio', () => {
      renderToolRail({
        activePanel: 'studio',
        user: null,
        onPanelChange: vi.fn(),
      });

      const toolButton = screen.getByRole('button', { name: 'Tool' });
      expect(toolButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('marks Chars as active when active panel is characters', () => {
      renderToolRail({
        activePanel: 'characters',
        user: null,
        onPanelChange: vi.fn(),
      });

      const charsButton = screen.getByRole('button', { name: 'Chars' });
      expect(charsButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('core behavior', () => {
    it('switches to studio panel when Tool is clicked', () => {
      const onPanelChange = vi.fn();

      renderToolRail({
        activePanel: 'sessions',
        user: null,
        onPanelChange,
      });

      const toolButton = screen.getByRole('button', { name: 'Tool' });
      toolButton.click();

      expect(onPanelChange).toHaveBeenCalledWith('studio');
    });

    it('shows sub badge when billing status is subscribed', () => {
      useBillingStatusMock.mockReturnValue({
        status: {
          isSubscribed: true,
          planTier: 'explorer',
          starterGrantCredits: 25,
          starterGrantGrantedAtMs: 123,
        },
        isLoading: false,
        error: null,
        refresh: vi.fn(),
      });

      renderToolRail({
        activePanel: 'studio',
        user: {
          uid: 'user-1',
          email: 'user@example.com',
          displayName: 'User',
        },
        onPanelChange: vi.fn(),
      });

      expect(screen.getByText('cr · sub')).toBeInTheDocument();
    });

    it('shows one-time rail hint and persists dismissal by user id', () => {
      renderToolRail({
        activePanel: 'studio',
        user: {
          uid: 'user-1',
          email: 'user@example.com',
          displayName: 'User',
        },
        onPanelChange: vi.fn(),
      });

      const hintButton = screen.getByRole('button', { name: 'Credits' });
      fireEvent.click(hintButton);

      expect(localStorage.getItem('credit-onboarding-dismissed:user-1')).toBe('1');
      expect(screen.queryByRole('button', { name: 'Credits' })).toBeNull();
    });
  });
});
