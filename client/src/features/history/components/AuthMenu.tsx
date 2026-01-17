import React, { useRef, useEffect } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@promptstudio/system/components/ui/button';
import type { User } from '@hooks/types';

export interface AuthMenuProps {
  user: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

/**
 * Auth menu component for user authentication actions
 */
export function AuthMenu({ user, onSignIn, onSignOut }: AuthMenuProps): React.ReactElement {
  const [showAuthMenu, setShowAuthMenu] = React.useState<boolean>(false);
  const authMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (authMenuRef.current && !authMenuRef.current.contains(event.target as Node)) {
        setShowAuthMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!user) {
    return (
      <Button
        onClick={onSignIn}
        size="sm"
        variant="default"
        className="w-full"
        aria-label="Sign in with Google"
      >
        <LogIn className="h-3.5 w-3.5" />
        Sign in
      </Button>
    );
  }

  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : '';
  const displayName = typeof user.displayName === 'string' ? user.displayName : '';
  const email = typeof user.email === 'string' ? user.email : '';

  return (
    <div className="relative" ref={authMenuRef}>
      <Button
        type="button"
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        variant="ghost"
        className="w-full items-center gap-2 rounded-lg p-2 transition-colors hover:bg-surface-1"
        aria-expanded={showAuthMenu}
        aria-label="User menu"
      >
        {photoURL && (
          <img
            src={photoURL}
            alt=""
            className="h-7 w-7 flex-shrink-0 rounded-full"
          />
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-label-12 text-foreground">
            {displayName}
          </p>
          <p className="truncate text-label-12 text-muted">
            {email}
          </p>
        </div>
      </Button>

      {showAuthMenu && (
        <div className="absolute bottom-full mb-2 left-0 w-full bg-app border border-border rounded-lg shadow-md py-1">
          <Button
            onClick={onSignOut}
            size="sm"
            variant="ghost"
            className="w-full"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
