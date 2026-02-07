import type { ReactElement } from 'react';
import { Home } from '@promptstudio/system/components/ui';
import { Link, useLocation } from 'react-router-dom';
import { ToolNavButton } from './ToolNavButton';
import { toolNavItems } from '../config/toolNavConfig';
import type { ToolRailProps } from '../types';

export function ToolRail({
  activePanel,
  onPanelChange,
  user,
}: ToolRailProps): ReactElement {
  const location = useLocation();
  const headerItem = toolNavItems.find((item) => item.variant === 'header');
  const navItems = toolNavItems.filter((item) => item.variant === 'default');
  const photoURL = typeof user?.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const initial = (displayName || email || 'U').slice(0, 1).toUpperCase();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const userActionLink = user ? '/account' : `/signin?redirect=${returnTo}`;
  const userActionLabel = user ? 'Account' : 'Sign in';

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
      className="flex h-full w-14 flex-none flex-col items-center border-r border-[#1A1C22] bg-[#0D0E12] py-2.5"
      aria-label="Tool navigation"
    >
      {/* ── Header (hamburger → sessions toggle) ── */}
      {headerItem && (
        <ToolNavButton
          icon={headerItem.icon}
          label={headerItem.label}
          isActive={activePanel === 'sessions'}
          onClick={() => handlePanelChange('sessions')}
          variant="header"
        />
      )}

      <div className="mx-auto my-1.5 h-px w-7 bg-[#1A1C22]" aria-hidden="true" />

      {/* ── Nav items: Tool, Apps, Chars, Styles ── */}
      <nav className="flex flex-col items-center gap-0.5" aria-label="Tool panels">
        {navItems.map((item) => (
          <ToolNavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activePanel === item.id}
            onClick={() => handlePanelChange(item.id)}
          />
        ))}
      </nav>

      <div className="flex-1" />

      {/* ── Bottom: Home + Avatar ── */}
      <div className="flex flex-col items-center gap-1.5 pb-1">
        <Link
          to="/home"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[#151720]"
          aria-label="Home"
        >
          <Home className="h-3.5 w-3.5 text-[#555B6E]" />
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
