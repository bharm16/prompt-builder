/**
 * Unified navigation orchestrator.
 *
 * Renders appropriate shell variant based on current route:
 * - 'topnav': Marketing pages (horizontal navbar)
 * - 'sidebar': Workspace pages (vertical sidebar)
 * - 'none': Auth pages (no shell)
 */

import { useEffect, useState, type ReactElement } from 'react';
import { getAuthRepository } from '@repositories/index';
import { useNavigationConfig } from './hooks/useNavigationConfig';
import { TopNavbar } from './variants/TopNavbar';
import { WorkspaceSidebar } from './variants/WorkspaceSidebar';
import type { AppShellProps } from './types';
import type { User } from '@hooks/types';

const noop = (..._args: unknown[]): void => {};

export function AppShell({
  children,
  showHistory = true,
  onToggleHistory,
  history = [],
  filteredHistory = [],
  isLoadingHistory = false,
  searchQuery = '',
  onSearchChange = noop,
  onLoadFromHistory = noop,
  onCreateNew = noop,
  onDelete = noop,
  onDuplicate,
  onRename,
  currentPromptUuid,
  currentPromptDocId,
  activeStatusLabel,
  activeModelLabel,
  assetsSidebar,
  sidebarTab,
  onSidebarTabChange,
}: AppShellProps): ReactElement {
  const { variant, navItems } = useNavigationConfig();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged(setUser);
    return () => unsubscribe();
  }, []);

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
      <WorkspaceSidebar
        navItems={navItems.sidebar}
        user={user}
        isExpanded={showHistory}
        onToggleExpanded={onToggleHistory ?? noop}
        history={history}
        filteredHistory={filteredHistory}
        isLoadingHistory={isLoadingHistory}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        onLoadFromHistory={onLoadFromHistory}
        onCreateNew={onCreateNew}
        onDelete={onDelete}
        assetsSidebar={assetsSidebar}
        sidebarTab={sidebarTab}
        onSidebarTabChange={onSidebarTabChange}
        {...(typeof onDuplicate === 'function' ? { onDuplicate } : {})}
        {...(typeof onRename === 'function' ? { onRename } : {})}
        {...(currentPromptUuid !== undefined ? { currentPromptUuid } : {})}
        {...(currentPromptDocId !== undefined ? { currentPromptDocId } : {})}
        {...(typeof activeStatusLabel === 'string' ? { activeStatusLabel } : {})}
        {...(typeof activeModelLabel === 'string' ? { activeModelLabel } : {})}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
