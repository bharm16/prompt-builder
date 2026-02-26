import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chrome, Eye, EyeOff, Mail } from '@promptstudio/system/components/ui';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { Input } from '@promptstudio/system/components/ui/input';
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

type AuthFlow = 'google' | 'email';

function mapAuthError(error: unknown, flow: AuthFlow): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/user-disabled':
      return 'This account is disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Try again in a bit.';
    case 'auth/operation-not-allowed':
      return flow === 'google'
        ? 'Google sign-in is disabled in Firebase Auth. Enable the Google provider in the Firebase console.'
        : 'Email/password sign-in is disabled in Firebase Auth.';
    case 'auth/popup-blocked':
      return 'Google popup was blocked. Allow popups for this tab and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google popup was closed before sign-in completed.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-in popup request was cancelled. Try again.';
    case 'auth/unauthorized-domain':
      return 'This localhost domain is not authorized in Firebase Auth settings.';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'Google sign-in is not supported in this embedded browser. Use email sign-in here or open the app in a regular browser.';
    default:
      return 'Failed to sign in. Please try again.';
  }
}

export function SignInPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);

  const user = useAuthUser();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    if (redirect) {
      navigate(redirect, { replace: true });
      return;
    }
    navigate('/', { replace: true });
  }, [navigate, redirect, user]);

  const inputClassName =
    'mt-1 w-full rounded-[12px] border border-white/10 bg-black/30 px-4 py-3 text-[14px] text-white placeholder-white/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/10';

  const handleGoogleSignIn = async (): Promise<void> => {
    setError(null);
    setIsBusy(true);
    try {
      const signedInUser = await getAuthRepository().signInWithGoogle();
      const displayName =
        typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
      toast.success(`Welcome, ${displayName}!`);
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      setError(mapAuthError(err, 'google'));
      toast.error('Failed to sign in. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailSignIn = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const normalizedEmail = email.trim();
      if (!normalizedEmail || !password) {
        setError('Enter your email and password.');
        return;
      }

      const signedInUser = await getAuthRepository().signInWithEmail(normalizedEmail, password);
      const displayName =
        typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'User';
      toast.success(`Welcome back, ${displayName}!`);
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      setError(mapAuthError(err, 'email'));
    } finally {
      setIsBusy(false);
    }
  };

  const forgotPasswordLink = React.useMemo(() => {
    const params = new URLSearchParams();
    if (redirect) params.set('redirect', redirect);
    const normalizedEmail = email.trim();
    if (normalizedEmail) params.set('email', normalizedEmail);
    const query = params.toString();
    return query ? `/forgot-password?${query}` : '/forgot-password';
  }, [email, redirect]);

  return (
    <AuthShell
      title="Sign in."
      subtitle="Luxury SaaS energy, Raycast-calm controls, Framer-grade motion. Sync history when you’re ready."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="text-white hover:underline">
            Create an account
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Welcome back</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Sign in to sync prompt history and keep your work consistent across devices.
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

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy}
          variant="ghost"
          className="h-11 w-full gap-2 rounded-[12px] border border-white/10 bg-white text-[14px] font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-px hover:bg-white hover:shadow-[0_18px_44px_rgba(0,0,0,0.45)] active:translate-y-0 active:shadow-[0_10px_30px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Spinner /> : <Chrome className="h-4 w-4" aria-hidden="true" />}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] font-medium text-white/40">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmailSignIn} className="flex flex-col gap-4">
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
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
              PASSWORD
            </label>
            <div className="relative">
              <Input
                className={`${inputClassName} pr-11`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
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

          <div className="flex items-center justify-between gap-3">
            <Link
              to={forgotPasswordLink}
              className="text-[13px] font-medium text-white/60 transition hover:text-white"
            >
              Forgot password?
            </Link>
            <Link
              to="/privacy-policy"
              className="text-[13px] font-medium text-white/40 transition hover:text-white/70"
            >
              Privacy
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            variant="ghost"
            className="h-11 w-full gap-2 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Spinner /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
