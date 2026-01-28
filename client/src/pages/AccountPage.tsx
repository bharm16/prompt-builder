import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, FileText, LogOut, Mail, SlidersHorizontal, Sparkles, User as UserIcon } from '@promptstudio/system/components/ui';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import type { User } from '@hooks/types';
import { AuthShell } from './auth/AuthShell';

function formatUserLabel(user: User): { title: string; subtitle: string } {
  const displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  const emailPrefix = email.split('@')[0] ?? '';
  const title = displayName || emailPrefix || 'Account';
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
  const email = user && typeof user.email === 'string' ? user.email : '';
  const isVerified = user && typeof user.emailVerified === 'boolean' ? user.emailVerified : false;
  const resetPasswordLink = email
    ? `/forgot-password?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent('/account')}`
    : `/forgot-password?redirect=${encodeURIComponent('/account')}`;

  const handleResendVerification = async (): Promise<void> => {
    if (!user) return;
    setIsBusy(true);
    try {
      await getAuthRepository().sendVerificationEmail('/account');
      toast.success('Verification email sent.');
    } catch {
      toast.error('Failed to send verification email.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AuthShell
      title="Account."
      subtitle="Manage your sign-in and keep your prompt history synced across devices."
      footer={
        user ? (
          <>
            Want to switch accounts?{' '}
            <Button
              type="button"
              onClick={handleSignOut}
              variant="link"
              className="h-auto p-0 text-white hover:underline"
              disabled={isBusy}
            >
              Sign out
            </Button>
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

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-white/70" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-white">Email</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">{email || '—'}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span
                    className={[
                      'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide',
                      isVerified
                        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
                        : 'border-amber-400/20 bg-amber-400/10 text-amber-100',
                    ].join(' ')}
                  >
                    {isVerified ? 'VERIFIED' : 'NOT VERIFIED'}
                  </span>

                  {!isVerified ? (
                    <Button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isBusy}
                      variant="ghost"
                      className="h-8 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[12px] font-semibold text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Resend verification
                    </Button>
                  ) : null}

                  {!isVerified ? (
                    <Link to="/email-verification?redirect=%2Faccount" className="text-[12px] font-semibold text-white/70 hover:text-white hover:underline">
                      Open verification page
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Link to="/history">Open history</Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-[12px] border border-white/10 bg-black/30 text-[14px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white"
            >
              <Link to={resetPasswordLink}>Reset password</Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="h-11 w-full gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Link to="/settings/billing">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                Billing
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="h-11 w-full gap-2 rounded-[12px] border border-white/10 bg-black/30 text-[14px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white"
            >
              <Link to="/settings/billing/invoices">
                <FileText className="h-4 w-4" aria-hidden="true" />
                Invoices
              </Link>
            </Button>

            <Button
              asChild
              variant="ghost"
              className="sm:col-span-2 h-11 w-full gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Link to="/?settings=1">
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                Preferences
              </Link>
            </Button>
          </div>

          <Button
            type="button"
            onClick={handleSignOut}
            disabled={isBusy}
            variant="ghost"
            className="h-11 w-full gap-2 rounded-[12px] border border-white/10 bg-red-500/10 text-[14px] font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign out
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold tracking-tight text-white">You’re not signed in</h2>
          <p className="text-[13px] leading-relaxed text-white/60">
            Sign in to sync prompt history and use Firestore storage across devices.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
            >
              <Link to="/signin">Sign in</Link>
            </Button>
            <Button
              asChild
              variant="ghost"
              className="h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.04] text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Link to="/signup">Create account</Link>
            </Button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
