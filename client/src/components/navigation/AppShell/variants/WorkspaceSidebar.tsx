/**
 * Vertical navigation for workspace pages.
 * Wraps HistorySection and adds nav links.
 */

import { useCallback, useRef, type ReactElement } from 'react';
import { PanelLeft, Plus } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import { HistorySection } from '@features/history/components/HistorySection';
import { cn } from '@utils/cn';
import { BrandLogo } from '../shared/BrandLogo';
import { NavLinks } from '../shared/NavLinks';
import { UserMenu } from '../shared/UserMenu';
import type { NavItem, WorkspaceSidebarProps } from '../types';

export function WorkspaceSidebar({
  navItems,
  user,
  isExpanded,
  onToggleExpanded,
  history,
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onLoadFromHistory,
  onCreateNew,
  onDelete,
  onDuplicate,
  onRename,
  currentPromptUuid,
  currentPromptDocId,
  activeStatusLabel,
  activeModelLabel,
  assetsSidebar,
  sidebarTab,
  onSidebarTabChange,
}: WorkspaceSidebarProps): ReactElement {
  const hoverExpandedRef = useRef(false);

  const handleMouseEnter = useCallback((): void => {
    if (isExpanded) return;
    hoverExpandedRef.current = true;
    onToggleExpanded(true);
  }, [isExpanded, onToggleExpanded]);

  const handleMouseLeave = useCallback((): void => {
    if (!hoverExpandedRef.current) return;
    hoverExpandedRef.current = false;
    onToggleExpanded(false);
  }, [onToggleExpanded]);

  const handlePermanentExpand = useCallback((): void => {
    hoverExpandedRef.current = false;
    onToggleExpanded(true);
  }, [onToggleExpanded]);

  const handleCollapse = useCallback((): void => {
    hoverExpandedRef.current = false;
    onToggleExpanded(false);
  }, [onToggleExpanded]);

  const duplicateProps = typeof onDuplicate === 'function' ? { onDuplicate } : {};
  const renameProps = typeof onRename === 'function' ? { onRename } : {};
  const statusProps =
    typeof activeStatusLabel === 'string' ? { activeStatusLabel } : {};
  const modelProps =
    typeof activeModelLabel === 'string' ? { activeModelLabel } : {};
  const promptIdProps =
    currentPromptUuid !== undefined ? { currentPromptUuid } : {};
  const promptDocProps =
    currentPromptDocId !== undefined ? { currentPromptDocId } : {};

  return (
    <aside
      id="workspace-sidebar"
      className={cn(
        'flex h-full min-h-0 flex-none flex-col overflow-hidden bg-sidebar p-4 transition-all duration-300',
        isExpanded ? 'w-sidebar max-w-sidebar' : 'w-[60px]'
      )}
      aria-label="Workspace navigation"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isExpanded ? (
        <ExpandedContent
          navItems={navItems}
          user={user}
          onCollapse={handleCollapse}
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
          {...duplicateProps}
          {...renameProps}
          {...promptIdProps}
          {...promptDocProps}
          {...statusProps}
          {...modelProps}
        />
      ) : (
        <CollapsedContent
          navItems={navItems}
          user={user}
          onCreateNew={onCreateNew}
          onPermanentExpand={handlePermanentExpand}
        />
      )}
    </aside>
  );
}

// -----------------------------------------------------------------------------
// Sub-components (private to this file)
// -----------------------------------------------------------------------------

interface ExpandedContentProps
  extends Omit<WorkspaceSidebarProps, 'isExpanded' | 'onToggleExpanded'> {
  onCollapse: () => void;
}

function ExpandedContent({
  navItems,
  user,
  onCollapse,
  history,
  filteredHistory,
  isLoadingHistory,
  searchQuery,
  onSearchChange,
  onLoadFromHistory,
  onCreateNew,
  onDelete,
  onDuplicate,
  onRename,
  currentPromptUuid,
  currentPromptDocId,
  activeStatusLabel,
  activeModelLabel,
  assetsSidebar,
  sidebarTab,
  onSidebarTabChange,
}: ExpandedContentProps): ReactElement {
  const duplicateProps = typeof onDuplicate === 'function' ? { onDuplicate } : {};
  const renameProps = typeof onRename === 'function' ? { onRename } : {};
  const statusProps =
    typeof activeStatusLabel === 'string' ? { activeStatusLabel } : {};
  const modelProps =
    typeof activeModelLabel === 'string' ? { activeModelLabel } : {};
  const promptIdProps =
    currentPromptUuid !== undefined ? { currentPromptUuid } : {};
  const promptDocProps =
    currentPromptDocId !== undefined ? { currentPromptDocId } : {};
  const hasAssetsTab = Boolean(assetsSidebar);
  const activeTab = sidebarTab ?? 'history';
  const handleTabChange = onSidebarTabChange ?? (() => {});

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center justify-between px-4">
        <BrandLogo variant="sidebar" />
        <Button
          onClick={onCollapse}
          variant="ghost"
          size="icon"
          aria-label="Collapse sidebar"
          className="h-7 w-7 rounded-md bg-[rgb(44,48,55)] text-muted hover:bg-[rgb(36,42,56)] hover:text-foreground"
        >
          <PanelLeft size={18} />
        </Button>
      </header>

      <div className="px-4 py-3">
        <NavLinks items={navItems} variant="vertical" />
      </div>

      <div className="mx-4 h-px bg-[rgb(41,44,50)]" />

      {hasAssetsTab && (
        <div className="mx-4 mt-3 flex rounded-lg border border-border bg-surface-1 p-1">
          <button
            type="button"
            onClick={() => handleTabChange('history')}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-semibold text-muted transition',
              activeTab === 'history' && 'bg-surface-2 text-foreground'
            )}
          >
            History
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('assets')}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-xs font-semibold text-muted transition',
              activeTab === 'assets' && 'bg-surface-2 text-foreground'
            )}
          >
            Assets
          </button>
        </div>
      )}

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        {activeTab === 'assets' && hasAssetsTab ? (
          <div className="min-h-0 flex-1 overflow-hidden">{assetsSidebar}</div>
        ) : (
          <HistorySection
            history={history}
            filteredHistory={filteredHistory}
            isLoadingHistory={isLoadingHistory}
            searchQuery={searchQuery}
            onSearchChange={onSearchChange}
            onLoadFromHistory={onLoadFromHistory}
            onCreateNew={onCreateNew}
            onDelete={onDelete}
            {...duplicateProps}
            {...renameProps}
            {...promptIdProps}
            {...promptDocProps}
            {...statusProps}
            {...modelProps}
          />
        )}
      </div>

      <footer className="mt-auto border-t border-[rgb(41,44,50)] px-4 py-3">
        <UserMenu user={user} variant="sidebar" />
      </footer>
    </div>
  );
}

interface CollapsedContentProps {
  navItems: readonly NavItem[];
  user: WorkspaceSidebarProps['user'];
  onCreateNew: () => void;
  onPermanentExpand: () => void;
}

function CollapsedContent({
  navItems,
  user,
  onCreateNew,
  onPermanentExpand,
}: CollapsedContentProps): ReactElement {
  const photoURL = typeof user?.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const initial = (displayName || email || 'U').slice(0, 1).toUpperCase();

  return (
    <div className="flex h-full flex-col items-center gap-2">
      <BrandLogo variant="sidebar-collapsed" />

      <div className="my-2 h-px w-6 bg-[rgb(41,44,50)]" />

      <NavLinks items={navItems} variant="vertical-collapsed" />

      <div className="my-2 h-px w-6 bg-[rgb(41,44,50)]" />

      <Button
        type="button"
        onClick={onCreateNew}
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-md bg-[rgb(44,48,55)] text-muted hover:bg-[rgb(36,42,56)] hover:text-foreground"
        aria-label="New prompt"
      >
        <Plus size={18} />
      </Button>

      <div className="mt-auto">
        {user ? (
          <Button
            type="button"
            onClick={onPermanentExpand}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md bg-[rgb(44,48,55)] text-muted hover:bg-[rgb(36,42,56)] hover:text-foreground"
            aria-label="User menu"
          >
            {photoURL ? (
              <img src={photoURL} alt="" className="h-6 w-6 rounded-full" />
            ) : (
              <span className="text-body-sm font-semibold">{initial}</span>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onPermanentExpand}
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md bg-[rgb(44,48,55)] text-muted hover:bg-[rgb(36,42,56)] hover:text-foreground"
            aria-label="Sign in"
          >
            <span className="text-body-sm">-&gt;</span>
          </Button>
        )}
      </div>
    </div>
  );
}
