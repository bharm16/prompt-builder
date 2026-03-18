import { useMemo, type ReactElement } from 'react';
import { GridFour, Home } from '@promptstudio/system/components/ui';
import { Link, useLocation } from 'react-router-dom';
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus';
import { useSidebarWorkspaceDomain } from '../context';
import { ToolNavButton } from './ToolNavButton';
import { toolNavItems } from '../config/toolNavConfig';
import type { ToolRailProps } from '../types';

export function ToolRail({
  activePanel,
  onPanelChange,
  user,
}: ToolRailProps): ReactElement {
  const location = useLocation();
  const { status, isLoading: isLoadingStatus } = useBillingStatus();
  const workspace = useSidebarWorkspaceDomain();
  const sessionsItem = toolNavItems.find((item) => item.variant === 'header');
  const navItems = toolNavItems.filter((item) => item.variant === 'default');
  const photoURL = typeof user?.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const initial = (displayName || email || 'U').slice(0, 1).toUpperCase();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const userActionLink = user ? '/account' : `/signin?redirect=${returnTo}`;
  const userActionLabel = user ? 'Account' : 'Sign in';
  const planLabel = useMemo((): string => {
    if (isLoadingStatus) return '…';
    if (!user) return 'Sign in';
    if (!status?.isSubscribed) return 'Free';
    const tier = status.planTier;
    if (!tier) return 'Free';
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }, [user, status, isLoadingStatus]);

  const handlePanelChange = (panelId: typeof activePanel): void => {
    if (panelId === 'sessions') {
      // Toggle sessions — if already viewing sessions, go back to studio
      onPanelChange(activePanel === 'sessions' ? 'studio' : 'sessions');
      return;
    }
    onPanelChange(panelId);
  };

  return (
    <aside
      className="flex h-full w-60 flex-none flex-col items-stretch border-r border-tool-rail-border bg-black px-2.5 py-2.5"
      aria-label="Tool navigation"
    >
      <div className="px-3.5 py-3">
        <span className="text-[19px] font-bold tracking-tight text-foreground">Vidra</span>
      </div>

      <div className="mx-1 my-1.5 h-px bg-tool-rail-border" aria-hidden="true" />

      {/* ── Nav items: Tool, Apps, Chars, Styles ── */}
      <nav className="flex flex-col items-stretch gap-0.5" aria-label="Tool panels">
        {navItems.map((item) => (
          <ToolNavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activePanel === item.id}
            onClick={() => handlePanelChange(item.id)}
          />
        ))}
        {workspace ? (
          <ToolNavButton
            icon={GridFour}
            label="Gallery"
            isActive={workspace.galleryOpen}
            onClick={workspace.toggleGallery}
          />
        ) : null}
        <div className="mx-1 my-1.5 h-px bg-tool-rail-border" aria-hidden="true" />
        {sessionsItem ? (
          <ToolNavButton
            icon={sessionsItem.icon}
            label={sessionsItem.label}
            isActive={activePanel === 'sessions'}
            onClick={() => handlePanelChange('sessions')}
            variant="header"
          />
        ) : null}
      </nav>

      <div className="flex-1" />

      {/* ── Bottom: Home + Profile ── */}
      <div className="flex w-full flex-col items-stretch gap-0.5 pb-2.5">
        <Link
          to="/home"
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-foreground transition-colors hover:bg-tool-nav-hover hover:text-foreground"
          aria-label="Home"
        >
          <Home className="h-5 w-5 shrink-0" weight="bold" />
          <span className="text-body-sm font-semibold leading-none tracking-[0.02em]">Home</span>
        </Link>

        <div className="mx-1 my-1 h-px bg-tool-rail-border" aria-hidden="true" />

        {/* ── Profile row ── */}
        <Link
          to={userActionLink}
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors hover:bg-tool-nav-hover"
          aria-label={userActionLabel}
        >
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="h-8 w-8 flex-none rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-surface-2">
              <span className="text-body-sm font-bold text-white">{initial}</span>
            </div>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-body-sm font-medium leading-none text-foreground">
              {displayName || email || 'Account'}
            </span>
            <span className="text-[11px] leading-none text-tool-text-subdued">
              {planLabel}
            </span>
          </div>
        </Link>
      </div>
    </aside>
  );
}
