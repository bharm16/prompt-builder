import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Mail, RefreshCw, ShieldAlert } from '@promptstudio/system/components/ui';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { useAuthUser } from '@hooks/useAuthUser';
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

function mapVerificationError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/invalid-action-code':
      return 'That verification link is invalid or already used.';
    case 'auth/expired-action-code':
      return 'That verification link has expired. Request a new one.';
    case 'auth/user-disabled':
      return 'This account is disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    default:
      return 'Failed to verify email. Please try again.';
  }
}

function mapResendError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/too-many-requests':
      return 'Too many emails sent. Try again later.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
    case 'auth/missing-continue-uri':
      return 'Email verification links aren’t configured for this domain yet.';
    default:
      return 'Failed to resend verification email. Please try again.';
  }
}

type VerifyState = 'idle' | 'verifying' | 'verified' | 'error';

export function EmailVerificationPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = getSafeRedirect(location.search);
  const oobCode = getOobCode(location.search);
  const mode = getMode(location.search);

  const user = useAuthUser();
  const [verifyState, setVerifyState] = React.useState<VerifyState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const [isResending, setIsResending] = React.useState(false);
  const [resendCooldown, setResendCooldown] = React.useState(0);
  const [emailHint, setEmailHint] = React.useState(() => getInitialEmail(location.search));

  React.useEffect(() => {
    const initial = getInitialEmail(location.search);
    setEmailHint(initial);
  }, [location.search]);

  React.useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setInterval(() => {
      setResendCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendCooldown]);

  React.useEffect(() => {
    if (!oobCode) return;
    if (mode && mode !== 'verifyEmail') {
      setVerifyState('error');
      setError('This link is not an email verification link.');
      return;
    }

    let cancelled = false;
    setVerifyState('verifying');
    setError(null);

    (async () => {
      try {
        await getAuthRepository().verifyEmailWithCode(oobCode);
        try {
          await getAuthRepository().refreshCurrentUser();
        } catch {
          // ignore refresh failures; verification already succeeded
        }
        if (cancelled) return;
        setVerifyState('verified');
        toast.success('Email verified.');
      } catch (err) {
        if (cancelled) return;
        setVerifyState('error');
        setError(mapVerificationError(err));
        toast.error('Email verification failed.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, oobCode, toast]);

  const continuePath = redirect ?? '/';
  const continueLink = user ? continuePath : `/signin?redirect=${encodeURIComponent(continuePath)}`;

  const userEmail = user && typeof user.email === 'string' ? user.email : '';
  const displayEmail = (userEmail || emailHint).trim();
  const isEmailVerified = user && typeof user.emailVerified === 'boolean' ? user.emailVerified : false;

  const handleResend = async (): Promise<void> => {
    setError(null);
    setIsResending(true);
    try {
      await getAuthRepository().sendVerificationEmail(redirect ?? undefined);
      toast.success('Verification email sent.');
      setResendCooldown(30);
    } catch (err) {
      setError(mapResendError(err));
      toast.error('Failed to send verification email.');
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = (): void => {
    if (user) {
      navigate(continuePath, { replace: true });
      return;
    }
    navigate(continueLink, { replace: true });
  };

  const showVerifiedPanel = verifyState === 'verified' || isEmailVerified;
  const showVerifyInProgress = verifyState === 'verifying';
  const showVerifyError = verifyState === 'error' && error;

  return (
    <AuthShell
      title="Verify your email."
      subtitle="A quick confirmation step. One link click — then you’re back to building prompts like it’s a product demo."
      footer={
        <>
          Need to sign in?{' '}
          <Link to={`/signin?redirect=${encodeURIComponent(continuePath)}`} className="text-white hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Account confirmation</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            We use verification to keep accounts clean and deliver resets securely.
          </p>
        </div>

        {showVerifyInProgress ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Spinner />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Verifying…</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  Applying your confirmation code. This should take a moment.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showVerifiedPanel ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                <CheckCircle2 className="h-5 w-5 text-emerald-200 animate-scale-in" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-emerald-100">Email verified</p>
                <p className="mt-1 text-[13px] leading-snug text-emerald-100/70">
                  You’re confirmed. Keep the momentum — jump back into the app.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {showVerifyError ? (
          <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-4 w-4 text-red-100/90" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-red-100">Verification failed</p>
                <p className="mt-1 text-[13px] leading-snug text-red-100/80">{error}</p>
              </div>
            </div>
          </div>
        ) : null}

        {!showVerifiedPanel ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
                <Mail className="h-4 w-4 text-white/80" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-white">Check your inbox</p>
                <p className="mt-1 text-[13px] leading-snug text-white/60">
                  {displayEmail ? (
                    <>
                      We sent a verification link to <span className="font-medium text-white">{displayEmail}</span>.
                      Click it to confirm.
                    </>
                  ) : (
                    <>Open the verification email and click the link to confirm.</>
                  )}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    onClick={handleResend}
                    disabled={!user || isResending || resendCooldown > 0}
                    variant="ghost"
                    className="h-11 gap-2 rounded-[12px] border border-white/10 bg-white/[0.04] px-4 text-[14px] font-semibold text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isResending ? <Spinner /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
                  </Button>

                  <Button
                    asChild
                    variant="ghost"
                    className="h-11 rounded-[12px] border border-white/10 bg-black/30 px-4 text-[14px] font-semibold text-white/80 transition hover:bg-black/40 hover:text-white"
                  >
                    <Link to={`/forgot-password${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}`}>
                      Password help
                    </Link>
                  </Button>
                </div>

                {!user ? (
                  <p className="mt-3 text-[12px] leading-relaxed text-white/45">
                    Sign in first to resend a verification email. If you’re on a different device, just click the link in your inbox.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleContinue}
          variant="ghost"
          className="h-11 w-full rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)]"
        >
          Continue
        </Button>
      </div>
    </AuthShell>
  );
}
