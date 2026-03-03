import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { GridFour, Home } from '@promptstudio/system/components/ui';
import { Link, useLocation } from 'react-router-dom';
import { useCreditBalance } from '@/contexts/CreditBalanceContext';
import { useBillingStatus } from '@/features/billing/hooks/useBillingStatus';
import { cn } from '@/utils/cn';
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
  const { balance, isLoading } = useCreditBalance();
  const { status, isLoading: isLoadingStatus } = useBillingStatus();
  const workspace = useSidebarWorkspaceDomain();
  const [showRailHint, setShowRailHint] = useState(false);
  const sessionsItem = toolNavItems.find((item) => item.variant === 'header');
  const navItems = toolNavItems.filter((item) => item.variant === 'default');
  const photoURL = typeof user?.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const initial = (displayName || email || 'U').slice(0, 1).toUpperCase();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const userActionLink = user ? '/account' : `/signin?redirect=${returnTo}`;
  const userActionLabel = user ? 'Account' : 'Sign in';
  const onboardingKey = useMemo(
    () => (user?.uid ? `credit-onboarding-dismissed:${user.uid}` : null),
    [user?.uid]
  );

  useEffect(() => {
    if (!onboardingKey) {
      setShowRailHint(false);
      return;
    }
    try {
      setShowRailHint(localStorage.getItem(onboardingKey) !== '1');
    } catch {
      setShowRailHint(false);
    }
  }, [onboardingKey]);

  const dismissRailHint = (): void => {
    if (onboardingKey) {
      try {
        localStorage.setItem(onboardingKey, '1');
      } catch {
        // Ignore storage failures; still hide the hint for this render.
      }
    }
    setShowRailHint(false);
  };

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
      className="flex h-full w-60 flex-none flex-col items-stretch border-r border-[#1A1C22] bg-black px-2.5 py-2.5"
      aria-label="Tool navigation"
    >
      <div className="px-3.5 py-3">
        <span className="text-[19px] font-bold tracking-tight text-[#E2E6EF]">Vidra</span>
      </div>

      <div className="mx-1 my-1.5 h-px bg-[#1A1C22]" aria-hidden="true" />

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
        <div className="mx-1 my-1.5 h-px bg-[#1A1C22]" aria-hidden="true" />
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

      {/* ── Bottom: Home + Avatar ── */}
      <div className="flex w-full flex-col items-stretch gap-1.5 pb-1">
        <Link
          to="/home"
          className="flex w-full items-center gap-3 rounded-lg px-3.5 py-3 text-left text-[#E2E6EF] transition-colors hover:bg-[#1C1E26] hover:text-[#E2E6EF]"
          aria-label="Home"
        >
          <Home className="h-5 w-5 shrink-0" weight="bold" />
          <span className="text-[13px] font-semibold leading-none tracking-[0.02em]">Home</span>
        </Link>

        {showRailHint ? (
          <button
            type="button"
            className="mx-1 rounded-md border border-[#1A1C22] bg-[#111318] px-1 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] text-amber-400"
            onClick={dismissRailHint}
            title="Dismiss credit onboarding hint"
          >
            Credits
          </button>
        ) : null}

        <Link
          to="/billing"
          className="flex h-8 w-full flex-col items-center justify-center rounded-lg transition-colors hover:bg-[#151720]"
          aria-label={`${balance ?? 0} credits - ${
            status?.isSubscribed ? 'subscribed plan' : 'free plan'
          } - view billing`}
        >
          {isLoading ? (
            <div className="h-2.5 w-6 animate-pulse rounded bg-[#1A1C22]" />
          ) : (
            <>
              <span
                className={cn(
                  'text-[10px] font-bold tabular-nums leading-none',
                  balance === 0 || balance === null ? 'text-amber-400' : 'text-[#8B92A5]'
                )}
              >
                {balance ?? 0}
              </span>
              <span
                className={cn(
                  'mt-0.5 text-[8px] leading-none',
                  status?.isSubscribed ? 'text-[#8B92A5]' : 'text-[#555B6E]'
                )}
              >
                {isLoadingStatus ? 'cr' : `cr · ${status?.isSubscribed ? 'sub' : 'free'}`}
              </span>
            </>
          )}
        </Link>

        {photoURL ? (
          <Link
            to={userActionLink}
            aria-label={userActionLabel}
            className="mt-1.5 flex h-7 w-7 items-center justify-center overflow-hidden rounded-full"
          >
            <img src={photoURL} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
          </Link>
        ) : (
          <Link
            to={userActionLink}
            aria-label={userActionLabel}
            className="mt-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-[#6C5CE7] to-[#8B5CF6]"
          >
            <span className="text-[11px] font-bold text-white">{initial}</span>
          </Link>
        )}
      </div>
    </aside>
  );
}
