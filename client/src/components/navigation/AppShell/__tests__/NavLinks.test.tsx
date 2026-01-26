import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NavLinks } from '../shared/NavLinks';
import type { NavItem } from '../types';

vi.mock('@promptstudio/system/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const DummyIcon = (props: { className?: string; size?: number }) => (
  <svg data-testid="icon" {...props} />
);

const items: NavItem[] = [
  { to: '/assets', label: 'Assets', icon: DummyIcon, showInTopNav: true, showInSidebar: true },
  { to: '/pricing', label: 'Pricing', icon: DummyIcon, showInTopNav: true, showInSidebar: false },
];

const renderWithRouter = (ui: React.ReactElement, path = '/assets') =>
  render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);

describe('NavLinks', () => {
  describe('error handling', () => {
    it('provides aria-labels for collapsed icon-only links', () => {
      renderWithRouter(<NavLinks items={items} variant="vertical-collapsed" />);

      const link = screen.getByRole('link', { name: 'Assets' });
      expect(link).toHaveAttribute('href', '/assets');
    });
  });

  describe('edge cases', () => {
    it('applies active styles for vertical links', () => {
      renderWithRouter(<NavLinks items={items} variant="vertical" />, '/assets');

      const link = screen.getByRole('link', { name: 'Assets' });
      expect(link).toHaveClass('text-foreground');
    });

    it('uses horizontal styling for top navigation', () => {
      renderWithRouter(<NavLinks items={items} variant="horizontal" />, '/pricing');

      const link = screen.getByRole('link', { name: 'Pricing' });
      expect(link).toHaveClass('uppercase');
    });
  });

  describe('core behavior', () => {
    it('renders links for each nav item', () => {
      renderWithRouter(<NavLinks items={items} variant="horizontal" />);

      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveTextContent('Assets');
      expect(links[1]).toHaveTextContent('Pricing');
    });
  });
});
