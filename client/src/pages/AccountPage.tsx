import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Sparkles, User as UserIcon } from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import type { User } from '@hooks/types';
import { AuthShell } from './auth/AuthShell';

function formatUserLabel(user: User): { title: string; subtitle: string } {
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const title = displayName || (email ? email.split('@')[0] : 'Account');
  return {
    title,
    subtitle: email ? email : 'Signed in',
  };
}

export function AccountPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const [user, setUser] = React.useState<User | null>(null);
  const [isBusy, setIsBusy] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSignOut = async (): Promise<void> => {
    setIsBusy(true);
    try {
      await getAuthRepository().signOut();
      toast.success('Signed out successfully');
      navigate('/signin', { replace: true });
    } catch {
      toast.error('Failed to sign out');
    } finally {
      setIsBusy(false);
    }
  };

  const label = user ? formatUserLabel(user) : null;

  return (
    <AuthShell
      title="Account."
      subtitle="Manage your sign-in and keep your prompt history synced across devices."
      footer={
        user ? (
          <>
            Want to switch accounts?{' '}
            <button
              type="button"
              onClick={handleSignOut}
              className="text-white hover:underline"
              disabled={isBusy}
            >
              Sign out
            </button>
            .
          </>
        ) : (
          <>
            Need an account?{' '}
            <Link to="/signup" className="text-white hover:underline">
              Create one
            </Link>
            .
          </>
        )
      }
    >
      {user ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10">
              <UserIcon className="h-5 w-5 text-white/80" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-white">{label?.title}</h2>
              <p className="mt-1 text-[13px] text-white/60">{label?.subtitle}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-4 w-4 text-white/70" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Sync is on</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  Prompt history is saved to the cloud when you’re signed in.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              to="/history"
              className="inline-flex h-11 w-full items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              Open history
            </Link>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={isBusy}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-red-500/10 text-[14px] font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">You’re not signed in</h2>
          <p className="text-[13px] leading-relaxed text-white/60">
            Sign in to sync prompt history and use Firestore storage across devices.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              to="/signin"
              className="inline-flex h-11 w-full items-center justify-center rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
            >
              Sign in
            </Link>
            <Link
              to="/signup"
              className="inline-flex h-11 w-full items-center justify-center rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              Create account
            </Link>
          </div>
        </div>
      )}
    </AuthShell>
  );
}

