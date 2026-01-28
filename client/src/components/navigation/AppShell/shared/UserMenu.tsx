/**
 * Unified auth dropdown for both shell variants.
 * Merges SignedInControl (TopNavbar) and AuthMenu (HistorySidebar).
 */

import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  CreditCard,
  LogIn,
  LogOut,
  Settings,
  User as UserIcon,
} from '@promptstudio/system/components/ui';
import { Button } from '@promptstudio/system/components/ui/button';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { cn } from '@utils/cn';
import type { UserMenuProps } from '../types';

/**
 * Extract display info from user object with fallbacks.
 */
function getUserDisplayInfo(user: NonNullable<UserMenuProps['user']>): {
  photoURL: string | null;
  displayName: string;
  email: string;
  firstName: string;
  initial: string;
} {
  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const rawFirstName = displayName
    ? displayName.split(/\s+/)[0] ?? ''
    : email
      ? email.split('@')[0] ?? ''
      : '';
  const firstName = rawFirstName || 'User';
  const initial = firstName.slice(0, 1).toUpperCase();

  return { photoURL, displayName, email, firstName, initial };
}

export function UserMenu({ user, variant, className }: UserMenuProps): ReactElement {
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleSignIn = useCallback(async (): Promise<void> => {
    try {
      await getAuthRepository().signInWithGoogle();
    } catch {
      toast.error('Failed to sign in');
    }
  }, [toast]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    try {
      await getAuthRepository().signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setOpen(false);
    }
  }, [toast]);

  if (!user) {
    if (variant === 'sidebar') {
      return (
        <Button
          onClick={handleSignIn}
          size="sm"
          variant="default"
          className={cn('w-full', className)}
          aria-label="Sign in with Google"
        >
          <LogIn className="h-3.5 w-3.5" />
          Sign in
        </Button>
      );
    }

    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Button
          asChild
          variant="ghost"
          className="h-auto rounded-md bg-[rgb(48,48,48)] px-[10px] py-[6px] text-[14px] font-semibold text-white transition-colors hover:bg-[rgb(58,58,58)]"
        >
          <Link to={`/signin?redirect=${returnTo}`}>Log in</Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-auto gap-2 rounded-md border border-black/5 bg-[rgb(247,247,247)] px-4 py-2 text-[14px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"
        >
          <Link to="/">Try Vidra</Link>
        </Button>
      </div>
    );
  }

  const { photoURL, displayName, email, firstName, initial } = getUserDisplayInfo(user);

  if (variant === 'sidebar') {
    return (
      <div className={cn('relative', className)} ref={containerRef}>
        <Button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          variant="ghost"
          className="w-full items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[rgba(255,255,255,0.05)]"
          aria-expanded={open}
          aria-label="User menu"
        >
          {photoURL ? (
            <img src={photoURL} alt="" className="h-9 w-9 flex-shrink-0 rounded-full" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-blue-500 text-[13px] font-semibold text-white">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[13px] font-semibold text-foreground">
              {displayName || firstName}
            </p>
            <p className="truncate text-[12px] font-normal text-muted">{email}</p>
          </div>
        </Button>

        {open && (
          <div className="absolute bottom-full left-0 mb-2 w-full rounded-lg border border-border bg-app py-1 shadow-md">
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link to="/account" onClick={() => setOpen(false)}>
                <UserIcon className="h-3.5 w-3.5" /> Account
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="w-full justify-start">
              <Link to="/settings/billing" onClick={() => setOpen(false)}>
                <CreditCard className="h-3.5 w-3.5" /> Billing
              </Link>
            </Button>
            <div className="my-1 h-px bg-border" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-red-600"
              onClick={handleSignOut}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)} ref={containerRef}>
      <Button
        asChild
        variant="ghost"
        className="h-auto gap-2 rounded-md border border-black/5 bg-[rgb(247,247,247)] px-4 py-2 text-[14px] font-semibold text-slate-900 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(0,0,0,0.10)]"
      >
        <Link to="/">Try Vidra</Link>
      </Button>

      <Button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        data-open={open}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        variant="ghost"
        className="relative top-[-1px] inline-flex h-8 items-center rounded-full border border-black/5 bg-gradient-to-br from-violet-500/10 to-blue-500/10 pl-1.5 pr-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition hover:-translate-y-px hover:border-violet-500/25 hover:shadow-[0_4px_12px_rgba(124,58,237,0.15)] data-[open=true]:border-violet-500/30 data-[open=true]:shadow-[0_6px_20px_rgba(124,58,237,0.25)]"
      >
        <span className="relative ml-1 grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-blue-500 text-[11px] font-semibold leading-5 text-white">
          {initial}
          {photoURL && (
            <img
              src={photoURL}
              alt=""
              className="absolute inset-0 h-5 w-5 rounded-full object-cover"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </span>
        <ChevronDown
          className={cn(
            'ml-1 mr-1 h-3 w-3 text-slate-900/50 transition-transform',
            open && 'rotate-180'
          )}
        />
      </Button>

      <div
        role="menu"
        aria-hidden={!open}
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'absolute right-0 top-[calc(100%+8px)] z-dropdown w-[220px] rounded-xl border border-black/5 bg-white p-2 shadow-[0_16px_48px_rgba(0,0,0,0.22)] origin-top-right transition',
          !open && 'pointer-events-none -translate-y-1 opacity-0'
        )}
      >
        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 hover:bg-violet-500/10"
        >
          <Link to="/account" role="menuitem" onClick={() => setOpen(false)}>
            <UserIcon className="h-3.5 w-3.5 text-slate-900/70" /> Account
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 hover:bg-violet-500/10"
        >
          <Link to="/settings/billing" role="menuitem" onClick={() => setOpen(false)}>
            <CreditCard className="h-3.5 w-3.5 text-slate-900/70" /> Billing
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 hover:bg-violet-500/10"
        >
          <Link to="/?settings=1" role="menuitem" onClick={() => setOpen(false)}>
            <Settings className="h-3.5 w-3.5 text-slate-900/70" /> Settings
          </Link>
        </Button>
        <div className="my-2.5 h-px w-full bg-black/5" />
        <Button
          variant="ghost"
          onClick={handleSignOut}
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-red-600 hover:bg-red-600/10"
        >
          <LogOut className="h-3.5 w-3.5 text-red-600/80" /> Sign out
        </Button>
      </div>
    </div>
  );
}
