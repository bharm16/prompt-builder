import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { Input } from '@promptstudio/system/components/ui/input';
import { AuthShell } from './auth/AuthShell';

function getSafeRedirect(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get('redirect');
  if (!raw) return null;
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  return raw;
}

function getInitialEmail(search: string): string {
  const params = new URLSearchParams(search);
  const raw = params.get('email');
  if (!raw) return '';
  return raw.trim();
}

function Spinner(): React.ReactElement {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function mapAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-not-found':
      return 'No account found for that email.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
      return 'Password reset links aren’t configured for this domain yet.';
    default:
      return 'Failed to send reset email. Please try again.';
  }
}

export function ForgotPasswordPage(): React.ReactElement {
  const toast = useToast();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);

  const [email, setEmail] = React.useState(() => getInitialEmail(location.search));
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEmail(getInitialEmail(location.search));
    setSentTo(null);
    setError(null);
  }, [location.search]);

  const inputClassName =
    'mt-1 w-full rounded-[12px] border border-white/10 bg-black/30 px-4 py-3 text-[14px] text-white placeholder-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/10';

  const handleSend = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    setError(null);
    setSentTo(null);

    if (!normalizedEmail) {
      setError('Enter your email address.');
      return;
    }

    setIsBusy(true);
    try {
      await getAuthRepository().sendPasswordReset(normalizedEmail, redirect ?? undefined);
      setSentTo(normalizedEmail);
      toast.success('Password reset email sent.');
    } catch (err) {
      setError(mapAuthError(err));
      toast.error('Failed to send reset email.');
    } finally {
      setIsBusy(false);
    }
  };

  const signInLink = redirect ? `/signin?redirect=${encodeURIComponent(redirect)}` : '/signin';

  return (
    <AuthShell
      title="Reset your password."
      subtitle="Fast recovery. No drama. We’ll email a reset link — you’ll be back in flow in under a minute."
      footer={
        <>
          Remembered it?{' '}
          <Link to={signInLink} className="text-white hover:underline">
            Back to sign in
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Password recovery</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Enter the email for your account. If it exists, we’ll send a reset link.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[13px] text-red-100"
          >
            {error}
          </div>
        ) : null}

        {sentTo ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-[13px] font-semibold text-white">Check your inbox</p>
            <p className="mt-1 text-[13px] leading-snug text-white/60">
              We sent a reset link to <span className="font-medium text-white">{sentTo}</span>. If you don’t see it, check spam.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSend} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
              EMAIL
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-[18px] h-4 w-4 text-white/30" aria-hidden="true" />
              <Input
                className={`${inputClassName} pl-11`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                disabled={isBusy}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            variant="ghost"
            className="h-11 w-full gap-2 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Spinner /> : null}
            Send reset email
          </Button>

          <div className="flex items-center justify-between gap-3">
            <Link
              to={signInLink}
              className="text-[13px] font-medium text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back to sign in
            </Link>
            <Link
              to="/privacy-policy"
              className="text-[13px] font-medium text-white/40 transition hover:text-white/70"
            >
              Privacy
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
