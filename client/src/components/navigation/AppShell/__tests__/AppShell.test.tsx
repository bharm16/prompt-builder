import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../AppShell';
import type { NavItemsByVariant } from '../types';

const unsubscribeMock = vi.fn();
const onAuthStateChangedMock = vi.fn(() => unsubscribeMock);
const useNavigationConfigMock = vi.fn();
let lastToolSidebarProps: any;

vi.mock('@repositories/index', () => ({
  getAuthRepository: () => ({
    onAuthStateChanged: onAuthStateChangedMock,
  }),
}));

vi.mock('../hooks/useNavigationConfig', () => ({
  useNavigationConfig: () => useNavigationConfigMock(),
}));

vi.mock('@components/ToolSidebar', () => ({
  ToolSidebar: (props: any) => {
    lastToolSidebarProps = props;
    return <div data-testid="tool-sidebar" />;
  },
}));

vi.mock('../variants/TopNavbar', () => ({
  TopNavbar: (props: any) => (
    <div data-testid="top-navbar" data-items={props.navItems.length} />
  ),
}));

describe('AppShell', () => {
  const navItems: NavItemsByVariant = {
    topNav: [{ to: '/pricing', label: 'Pricing', icon: () => null, showInTopNav: true, showInSidebar: true }],
    sidebar: [{ to: '/assets', label: 'Assets', icon: () => null, showInTopNav: false, showInSidebar: true }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useNavigationConfigMock.mockReturnValue({
      variant: 'sidebar',
      navItems,
      currentPath: '/assets',
    });
  });

  describe('error handling', () => {
    it('cleans up auth subscription on unmount', () => {
      const { unmount } = render(<AppShell>Content</AppShell>);

      unmount();

      expect(onAuthStateChangedMock).toHaveBeenCalledTimes(1);
      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('renders children without shell for auth routes', () => {
      useNavigationConfigMock.mockReturnValue({
        variant: 'none',
        navItems,
        currentPath: '/signin',
      });

      render(<AppShell>Auth Content</AppShell>);

      expect(screen.getByText('Auth Content')).toBeInTheDocument();
      expect(screen.queryByTestId('top-navbar')).toBeNull();
      expect(screen.queryByTestId('tool-sidebar')).toBeNull();
    });

    it('falls back to empty assetsByType when not provided', () => {
      useNavigationConfigMock.mockReturnValue({
        variant: 'sidebar',
        navItems,
        currentPath: '/assets',
      });

      render(
        <AppShell assets={[]} isLoadingAssets={false}>
          Content
        </AppShell>
      );

      expect(screen.getByTestId('tool-sidebar')).toBeInTheDocument();
      expect(lastToolSidebarProps.assetsByType).toEqual({
        character: [],
        style: [],
        location: [],
        object: [],
      });
    });
  });

  describe('core behavior', () => {
    it('renders top navigation variant with nav items', () => {
      useNavigationConfigMock.mockReturnValue({
        variant: 'topnav',
        navItems,
        currentPath: '/pricing',
      });

      render(<AppShell>Marketing</AppShell>);

      expect(screen.getByTestId('top-navbar')).toBeInTheDocument();
      expect(screen.getByText('Marketing')).toBeInTheDocument();
    });

    it('renders sidebar variant with ToolSidebar and workspace content', () => {
      useNavigationConfigMock.mockReturnValue({
        variant: 'sidebar',
        navItems,
        currentPath: '/assets',
      });

      render(<AppShell>Workspace</AppShell>);

      expect(screen.getByTestId('tool-sidebar')).toBeInTheDocument();
      expect(screen.getByText('Workspace')).toBeInTheDocument();
    });
  });
});
