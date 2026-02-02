import type { ReactElement } from 'react';
import { Home } from '@promptstudio/system/components/ui';
import { Link, useLocation } from 'react-router-dom';
import { ToolNavButton } from './ToolNavButton';
import { toolNavItems } from '../config/toolNavConfig';
import type { ToolRailProps } from '../types';
import { logger } from '@/services/LoggingService';

const log = logger.child('ToolRail');

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
  /**
   * Handle panel change for left-side panels
   */
  const handlePanelChange = (panelId: typeof activePanel): void => {
    if (panelId === 'sessions') {
      if (activePanel === 'sessions') {
        log.debug('Toggling back to workspace panel', { fromPath: location.pathname });
        onPanelChange('studio');
        return;
      }
      log.debug('Sessions panel selected from rail', { fromPath: location.pathname });
      onPanelChange('sessions');
      return;
    }
    log.debug('Library panel selected from rail', { panelId, fromPath: location.pathname });
    onPanelChange(panelId);
  };

  /**
   * Determine if a panel is active, considering both panel state and tool state
   */
  const isPanelActive = (panelId: typeof activePanel): boolean => {
    if (panelId === 'sessions') {
      return activePanel === 'sessions' || activePanel === 'studio';
    }
    return activePanel === panelId;
  };

  return (
    <aside
      className="w-[60px] h-full bg-[#131416] border-r border-[#1B1E23] flex-none relative overflow-hidden text-white text-base leading-4"
      aria-label="Tool navigation"
    >
      <div className="h-full px-2.5 flex flex-col gap-3">
        <div className="h-[58px] py-3 flex flex-col">
          {headerItem && (
            <ToolNavButton
              icon={headerItem.icon}
              label={headerItem.label}
              isActive={activePanel === headerItem.id}
              onClick={() => handlePanelChange(headerItem.id)}
              variant="header"
            />
          )}
          <div className="w-10 h-px bg-[#1B1E23] mt-auto" />
        </div>

        <nav className="flex flex-col gap-4" aria-label="Tool panels">
          {navItems.map((item) => (
            <ToolNavButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={isPanelActive(item.id)}
              onClick={() => handlePanelChange(item.id)}
            />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-4 pb-4">
          <Link
            to="/home"
            className="w-6 h-6 p-1 rounded-md flex items-center justify-center hover:bg-[#2C3037]"
            aria-label="Home"
          >
            <Home className="w-4 h-4 text-[#A0AEC0]" />
          </Link>

          {photoURL ? (
            <Link
              to={userActionLink}
              aria-label={userActionLabel}
              className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center hover:bg-[#2C3037] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <img src={photoURL} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
            </Link>
          ) : (
            <Link
              to={userActionLink}
              aria-label={userActionLabel}
              className="w-6 h-6 rounded-full bg-[#2C3037] flex items-center justify-center hover:bg-[#3A3F48] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
            >
              <span className="text-[11px] font-medium text-white">{initial}</span>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
}
