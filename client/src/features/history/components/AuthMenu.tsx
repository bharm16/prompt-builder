import React, { useRef, useEffect } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { Button } from '@components/Button';
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
        size="small"
        variant="primary"
        prefix={<LogIn className="h-3.5 w-3.5" />}
        className="w-full"
        aria-label="Sign in with Google"
      >
        Sign in
      </Button>
    );
  }

  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : '';
  const displayName = typeof user.displayName === 'string' ? user.displayName : '';
  const email = typeof user.email === 'string' ? user.email : '';

  return (
    <div className="relative" ref={authMenuRef}>
      <button
        onClick={() => setShowAuthMenu(!showAuthMenu)}
        className="flex w-full items-center gap-geist-2 rounded-geist-lg p-geist-2 transition-colors hover:bg-geist-accents-1"
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
          <p className="truncate text-label-12 text-geist-foreground">
            {displayName}
          </p>
          <p className="truncate text-label-12 text-geist-accents-5">
            {email}
          </p>
        </div>
      </button>

      {showAuthMenu && (
        <div className="absolute bottom-full mb-geist-2 left-0 w-full bg-geist-background border border-geist-accents-2 rounded-geist-lg shadow-geist-medium py-geist-1">
          <Button
            onClick={onSignOut}
            size="small"
            variant="ghost"
            prefix={<LogOut className="h-3.5 w-3.5" />}
            className="w-full"
          >
            Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
