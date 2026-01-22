import type { ReactElement } from 'react';
import { Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ToolNavButton } from './ToolNavButton';
import { toolNavItems } from '../config/toolNavConfig';
import type { ToolRailProps } from '../types';

export function ToolRail({
  activePanel,
  onPanelChange,
  user,
}: ToolRailProps): ReactElement {
  const headerItem = toolNavItems.find((item) => item.variant === 'header');
  const navItems = toolNavItems.filter((item) => item.variant === 'default');
  const photoURL = typeof user?.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user?.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  const initial = (displayName || email || 'U').slice(0, 1).toUpperCase();

  return (
    <aside
      className="w-[60px] h-full bg-[#131416] border-r border-[#1B1E23] flex-none"
      aria-label="Tool navigation"
    >
      <div className="h-full px-2.5 flex flex-col gap-3">
        <div className="h-[58px] py-3 flex flex-col">
          {headerItem && (
            <ToolNavButton
              icon={headerItem.icon}
              label={headerItem.label}
              isActive={activePanel === headerItem.id}
              onClick={() => onPanelChange(headerItem.id)}
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
              isActive={activePanel === item.id}
              onClick={() => onPanelChange(item.id)}
            />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex flex-col gap-4 pb-4">
          <Link
            to="/home"
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[#2C3037]"
            aria-label="Home"
          >
            <Home className="w-5 h-5 text-[#A1AFC5]" />
          </Link>

          {photoURL ? (
            <img src={photoURL} alt="" className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-[#2C3037] flex items-center justify-center">
              <span className="text-[11px] font-medium text-white">{initial}</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
