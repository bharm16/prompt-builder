import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopNavbar } from '../variants/TopNavbar';
import type { NavItem } from '../types';

vi.mock('../shared/BrandLogo', () => ({
  BrandLogo: () => <div data-testid="brand-logo" />,
}));

vi.mock('../shared/NavLinks', () => ({
  NavLinks: (props: any) => (
    <div data-testid="nav-links" data-count={props.items.length} />
  ),
}));

vi.mock('../shared/UserMenu', () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

describe('TopNavbar', () => {
  const navItems: NavItem[] = [
    { to: '/pricing', label: 'Pricing', icon: () => null, showInTopNav: true, showInSidebar: false },
  ];

  describe('error handling', () => {
    it('renders banner role for accessibility', () => {
      render(<TopNavbar navItems={navItems} user={null} />);

      const banner = screen.getByRole('banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveStyle({ height: 'var(--global-top-nav-height)' });
    });
  });

  describe('edge cases', () => {
    it('still renders shell elements when nav items are empty', () => {
      render(<TopNavbar navItems={[]} user={null} />);

      expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
      expect(screen.getByTestId('nav-links')).toHaveAttribute('data-count', '0');
    });
  });

  describe('core behavior', () => {
    it('renders brand logo, nav links, and user menu', () => {
      render(<TopNavbar navItems={navItems} user={null} />);

      expect(screen.getByTestId('brand-logo')).toBeInTheDocument();
      expect(screen.getByTestId('nav-links')).toHaveAttribute('data-count', '1');
      expect(screen.getByTestId('user-menu')).toBeInTheDocument();
    });
  });
});
