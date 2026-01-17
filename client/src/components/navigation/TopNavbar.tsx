import React from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, CreditCard, LogOut, Settings, User as UserIcon } from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import type { User } from '@hooks/types';

type TopNavbarLinkProps = {
  to: string;
  children: React.ReactNode;
};

function TopNavbarLink({ to, children }: TopNavbarLinkProps): React.ReactElement {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'text-label-13-mono',
          'px-2 py-1 rounded-md',
          'transition-colors',
          isActive
            ? 'text-foreground bg-surface-1'
            : 'text-muted hover:text-foreground hover:bg-surface-1',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

function SignedInControl({ user }: { user: User }): React.ReactElement {
  const toast = useToast();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (!open) return;
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!open) return;
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const photoURL = typeof user.photoURL === 'string' ? user.photoURL : null;
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user.email === 'string' ? user.email.trim() : '';

  const firstName = displayName
    ? displayName.split(/\s+/)[0]
    : email
      ? email.split('@')[0]
      : 'User';

  const initial = (firstName || 'U').slice(0, 1).toUpperCase();

  const handleSignOut = async (): Promise<void> => {
    try {
      await getAuthRepository().signOut();
      toast.success('Signed out successfully');
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        data-open={open ? 'true' : 'false'}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className={[
          'relative top-[-1px]',
          'inline-flex h-8 items-center rounded-full',
          'pl-1.5 pr-2',
          'border border-black/5',
          'bg-gradient-to-br from-violet-500/10 to-blue-500/10',
          'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
          'transition duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'hover:-translate-y-px',
          'hover:border-violet-500/25',
          'hover:bg-gradient-to-br hover:from-violet-500/14 hover:to-blue-500/12',
          'hover:shadow-[0_4px_12px_rgba(124,58,237,0.15)]',
          'data-[open=true]:shadow-[0_6px_20px_rgba(124,58,237,0.25)]',
          'data-[open=true]:border-violet-500/30',
          'data-[open=true]:bg-gradient-to-br data-[open=true]:from-violet-500/18 data-[open=true]:to-blue-500/14',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
        ].join(' ')}
        variant="ghost"
      >
        <span className="relative grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-600 to-blue-500 ml-1 text-[11px] font-semibold leading-5 text-white">
          {initial}
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="absolute inset-0 h-5 w-5 rounded-full object-cover"
              referrerPolicy="no-referrer"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
        </span>

        <span
          data-open={open ? 'true' : 'false'}
          className="ml-1 mr-1 text-slate-900/50 transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] data-[open=true]:rotate-180"
        >
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        </span>
      </Button>

      <div
        role="menu"
        aria-hidden={!open}
        data-state={open ? 'open' : 'closed'}
        className={[
          'absolute right-0 top-[calc(100%+8px)] z-dropdown',
          'w-[220px] rounded-xl border border-black/5 bg-white p-2',
          'shadow-[0_16px_48px_rgba(0,0,0,0.22)]',
          'origin-top-right',
          'transition duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0 data-[state=closed]:-translate-y-1',
          'data-[state=open]:opacity-100 data-[state=open]:translate-y-0',
        ].join(' ')}
      >
        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-violet-500/10 focus:outline-none focus-visible:bg-violet-500/10"
        >
          <Link
            to="/account"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          >
            <UserIcon className="relative top-[-0.5px] h-3.5 w-3.5 text-slate-900/70" aria-hidden="true" />
            Account
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-violet-500/10 focus:outline-none focus-visible:bg-violet-500/10"
        >
          <Link
            to="/settings/billing"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          >
            <CreditCard className="relative top-[-0.5px] h-3.5 w-3.5 text-slate-900/70" aria-hidden="true" />
            Billing
          </Link>
        </Button>

        <Button
          asChild
          variant="ghost"
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-slate-900 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-violet-500/10 focus:outline-none focus-visible:bg-violet-500/10"
        >
          <Link
            to="/?settings=1"
            role="menuitem"
            tabIndex={open ? 0 : -1}
            onClick={() => setOpen(false)}
          >
            <Settings className="relative top-[-0.5px] h-3.5 w-3.5 text-slate-900/70" aria-hidden="true" />
            Settings
          </Link>
        </Button>

        <div className="my-2.5 h-px w-full bg-black/5" role="separator" />

        <Button
          type="button"
          role="menuitem"
          tabIndex={open ? 0 : -1}
          onClick={handleSignOut}
          className="h-8 w-full items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-red-600 transition-colors duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] hover:bg-red-600/10 focus:outline-none focus-visible:bg-red-600/10"
          variant="ghost"
        >
          <LogOut className="relative top-[-0.5px] h-3.5 w-3.5 text-red-600/80" aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  );
}

export function TopNavbar(): React.ReactElement {
  const location = useLocation();
  const [user, setUser] = React.useState<User | null>(null);
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <header
      className="sticky top-0 z-50 w-full bg-app/90 backdrop-blur-md border-b border-border"
      style={{ height: 'var(--global-top-nav-height)' }}
      role="banner"
    >
      <div className="mx-auto h-full max-w-7xl px-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            to="/home"
            className="text-heading-20 text-foreground tracking-tight"
            aria-label="Vidra home"
          >
            Vidra
          </Link>

          <nav aria-label="Company navigation" className="hidden sm:flex items-center gap-2">
            <TopNavbarLink to="/products">Products</TopNavbarLink>
            <TopNavbarLink to="/pricing">Pricing</TopNavbarLink>
            <TopNavbarLink to="/docs">Docs</TopNavbarLink>
            <TopNavbarLink to="/contact">Support</TopNavbarLink>
            <TopNavbarLink to="/history">History</TopNavbarLink>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <SignedInControl user={user} />
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                className="h-9 rounded-md px-3 text-[13px] font-medium text-muted transition-colors hover:bg-surface-1 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10"
              >
                <Link to={`/signin?redirect=${returnTo}`}>Sign in</Link>
              </Button>
              <Button
                asChild
                variant="ghost"
                className={[
                  'h-9 rounded-full',
                  'px-3',
                  'border border-black/5',
                  'bg-gradient-to-br from-violet-500/12 to-blue-500/10',
                  'text-[13px] font-semibold text-slate-900',
                  'shadow-[0_1px_2px_rgba(0,0,0,0.04)]',
                  'transition duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]',
                  'hover:-translate-y-px',
                  'hover:border-violet-500/25',
                  'hover:bg-gradient-to-br hover:from-violet-500/16 hover:to-blue-500/14',
                  'hover:shadow-[0_6px_18px_rgba(124,58,237,0.16)]',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/25 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                ].join(' ')}
              >
                <Link to={`/signup?redirect=${returnTo}`}>Create account</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
