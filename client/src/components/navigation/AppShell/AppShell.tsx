/**
 * Unified navigation orchestrator.
 *
 * Renders appropriate shell variant based on current route:
 * - 'topnav': Marketing pages (horizontal navbar)
 * - 'sidebar': Workspace pages (vertical sidebar)
 * - 'none': Auth pages (no shell)
 */

import { memo, type ReactElement } from 'react';

import { ToolSidebar } from '@components/ToolSidebar';
import { useAuthUser } from '@hooks/useAuthUser';
import { CreditBalanceProvider } from '@/contexts/CreditBalanceContext';

import type { AppShellProps } from './types';
import { useNavigationConfig } from './hooks/useNavigationConfig';
import { TopNavbar } from './variants/TopNavbar';

export const AppShell = memo(function AppShell(props: AppShellProps): ReactElement {
  const { children, toolSidebarProps } = props;
  const { variant, navItems } = useNavigationConfig();
  const user = useAuthUser();

  if (variant === 'none') {
    return <>{children}</>;
  }

  if (variant === 'topnav') {
    return (
      <div className="flex min-h-full flex-col bg-app">
        <TopNavbar navItems={navItems.topNav} user={user} />
        <div className="min-h-0 flex-1 pt-[var(--global-top-nav-height)]">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-app">
      <CreditBalanceProvider userId={user?.uid ?? null}>
        <ToolSidebar {...(toolSidebarProps ?? {})} user={user} />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
          {children}
        </div>
      </CreditBalanceProvider>
    </div>
  );
});

AppShell.displayName = 'AppShell';
