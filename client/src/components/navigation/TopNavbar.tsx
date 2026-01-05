import React from 'react';
import { Link, NavLink } from 'react-router-dom';

type TopNavbarLinkProps = {
  to: string;
  children: React.ReactNode;
};

function TopNavbarLink({ to, children }: TopNavbarLinkProps): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'text-label-13-mono',
          'px-2 py-1 rounded-geist',
          'transition-colors',
          isActive
            ? 'text-geist-foreground bg-geist-accents-1'
            : 'text-geist-accents-6 hover:text-geist-foreground hover:bg-geist-accents-1',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

export function TopNavbar(): React.ReactElement {
  return (
    <header
      className="sticky top-0 z-50 w-full bg-geist-background/90 backdrop-blur-md border-b border-geist-accents-2"
      style={{ height: 'var(--global-top-nav-height)' }}
      role="banner"
    >
      <div className="mx-auto h-full max-w-7xl px-6 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/home"
            className="text-heading-20 text-geist-foreground tracking-tight"
            aria-label="Vidra home"
          >
            Vidra
          </Link>

          <nav aria-label="Company navigation" className="hidden sm:flex items-center gap-2">
            <TopNavbarLink to="/products">Products</TopNavbarLink>
            <TopNavbarLink to="/pricing">Pricing</TopNavbarLink>
            <TopNavbarLink to="/docs">Docs</TopNavbarLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <NavLink
            to="/signin"
            className={({ isActive }) =>
              [
                'text-label-13-mono',
                'px-3 py-1.5 rounded-geist-lg',
                'border border-geist-accents-2',
                'transition-colors',
                isActive
                  ? 'text-geist-foreground bg-geist-accents-1'
                  : 'text-geist-accents-6 hover:text-geist-foreground hover:bg-geist-accents-1',
              ].join(' ')
            }
          >
            Sign In
          </NavLink>
        </div>
      </div>
    </header>
  );
}


