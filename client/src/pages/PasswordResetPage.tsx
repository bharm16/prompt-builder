import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, KeyRound, ShieldAlert } from 'lucide-react';
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

function getOobCode(search: string): string | null {
  const params = new URLSearchParams(search);
  const code = params.get('oobCode');
  return code ? code.trim() : null;
}

function getMode(search: string): string | null {
  const params = new URLSearchParams(search);
  const mode = params.get('mode');
  return mode ? mode.trim() : null;
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

function mapResetError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/invalid-action-code':
      return 'That reset link is invalid or already used.';
    case 'auth/expired-action-code':
      return 'That reset link has expired. Request a new one.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account is disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    default:
      return 'Failed to reset password. Please try again.';
  }
}

type ResetState = 'idle' | 'checking' | 'ready' | 'success' | 'error';

export function PasswordResetPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = getSafeRedirect(location.search);
  const oobCode = getOobCode(location.search);
  const mode = getMode(location.search);

  const [resetState, setResetState] = React.useState<ResetState>(oobCode ? 'checking' : 'idle');
  const [email, setEmail] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setError(null);
    setEmail(null);
    setPassword('');
    setConfirmPassword('');

    if (!oobCode) {
      setResetState('idle');
      return;
    }

    if (mode && mode !== 'resetPassword') {
      setResetState('error');
      setError('This link is not a password reset link.');
      return;
    }

    let cancelled = false;
    setResetState('checking');

    (async () => {
      try {
        const linkedEmail = await getAuthRepository().validatePasswordResetCode(oobCode);
        if (cancelled) return;
        setEmail(linkedEmail);
        setResetState('ready');
      } catch (err) {
        if (cancelled) return;
        setResetState('error');
        setError(mapResetError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode]);

  const inputClassName =
    'mt-1 w-full rounded-[12px] border border-white/10 bg-black/30 px-4 py-3 text-[14px] text-white placeholder-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/10';

  const continuePath = redirect ?? '/';
  const signInLink = `/signin?redirect=${encodeURIComponent(continuePath)}`;
  const forgotPasswordLink = `/forgot-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`;

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!oobCode) return;

    setError(null);

    const normalizedPassword = password;
    if (!normalizedPassword) {
      setError('Enter a new password.');
      return;
    }
    if (normalizedPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (normalizedPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsBusy(true);
    try {
      await getAuthRepository().confirmPasswordResetWithCode(oobCode, normalizedPassword);
      setResetState('success');
      toast.success('Password updated.');
    } catch (err) {
      setError(mapResetError(err));
      toast.error('Password reset failed.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleContinue = (): void => {
    navigate(signInLink, { replace: true });
  };

  return (
    <AuthShell
      title="Set a new password."
      subtitle="A secure reset link, a clean form, and you’re back in flow — Superhuman speed, Raycast calm."
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
          <h2 className="text-lg font-semibold tracking-tight text-white">Password reset</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Choose a strong password you’ll actually remember — fast to type, hard to guess.
          </p>
        </div>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-red-100/90" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-red-100">Action required</p>
                <p className="mt-1 text-[13px] leading-snug text-red-100/80">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {resetState === 'idle' ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <KeyRound className="h-4 w-4 text-white/80" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Open your reset link</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  This page needs a secure code from your email. Use the link we sent you.
                </p>
                <div className="mt-3">
                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 w-full rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
                  >
                    <Link to={forgotPasswordLink}>Request a new reset email</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {resetState === 'checking' ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Spinner />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Validating link…</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  Checking that your reset link is still active.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {resetState === 'error' ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <KeyRound className="h-4 w-4 text-white/80" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Get a fresh link</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  If this link expired or was already used, request a new reset email.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
                  >
                    <Link to={forgotPasswordLink}>Request new email</Link>
                  </Button>
                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
                  >
                    <Link to={signInLink}>Back to sign in</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {resetState === 'success' ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-200 animate-scale-in" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-emerald-100">Password updated</p>
                <p className="mt-1 text-[13px] leading-snug text-emerald-100/70">
                  You’re good. Sign in with your new password.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {resetState === 'ready' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
              <p className="text-[12px] font-semibold tracking-[0.18em] text-white/45">RESETTING FOR</p>
              <p className="mt-1 text-[13px] font-medium text-white">{email}</p>
            </div>

            <div>
              <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
                NEW PASSWORD
              </label>
              <div className="relative">
                <Input
                  className={`${inputClassName} pr-11`}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  disabled={isBusy}
                />
                <Button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  variant="ghost"
                  size="icon"
                  className="absolute right-3 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full p-0 text-white/50 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isBusy}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
                CONFIRM PASSWORD
              </label>
              <Input
                className={inputClassName}
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Repeat your password"
                disabled={isBusy}
              />
            </div>

            <Button
              type="submit"
              disabled={isBusy}
              variant="ghost"
              className="h-11 w-full gap-2 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy ? <Spinner /> : null}
              Update password
            </Button>

            <div className="flex items-center justify-between gap-3">
              <Link
                to={signInLink}
                className="text-[13px] font-medium text-white/60 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back to sign in
              </Link>
              <Link
                to={forgotPasswordLink}
                className="text-[13px] font-medium text-white/40 transition hover:text-white/70"
              >
                New link
              </Link>
            </div>
          </form>
        ) : null}

        {resetState === 'success' ? (
          <Button
            type="button"
            onClick={handleContinue}
            variant="ghost"
            className="h-11 w-full rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-[14px] font-semibold text-white transition hover:bg-white/[0.06]"
          >
            Continue to sign in
          </Button>
        ) : null}
      </div>
    </AuthShell>
  );
}
