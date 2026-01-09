import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chrome, Eye, EyeOff, Mail, User as UserIcon } from 'lucide-react';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import type { User } from '@hooks/types';
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

function mapAuthError(error: unknown): string {
  if (!error || typeof error !== 'object') return 'Something went wrong. Please try again.';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : null;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-up is disabled in Firebase Auth.';
    default:
      return 'Failed to create account. Please try again.';
  }
}

export function SignUpPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);

  const [user, setUser] = React.useState<User | null>(null);
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const unsubscribe = getAuthRepository().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

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

  const handleGoogleSignUp = async (): Promise<void> => {
    setError(null);
    setIsBusy(true);
    try {
      const signedInUser = await getAuthRepository().signInWithGoogle();
      const name =
        typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'there';
      toast.success(`Welcome, ${name}!`);
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailSignUp = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsBusy(true);
    try {
      const normalizedEmail = email.trim();
      const normalizedName = displayName.trim();

      if (!normalizedEmail || !password) {
        setError('Enter your name (optional), email, and password.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }

      const newUser = await getAuthRepository().signUpWithEmail(normalizedEmail, password, normalizedName);
      const name = typeof newUser.displayName === 'string' ? newUser.displayName : 'there';
      toast.success(`Account created. Welcome, ${name}!`);
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account."
      subtitle="Superhuman-level focus, Arc editorial vibes, Raycast polish. Start fast — upgrade to sync whenever you want."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/signin" className="text-white hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-white">Get started</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-white/60">
            Create an account to sync history, save versions, and pick up exactly where you left off.
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

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isBusy}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white text-[14px] font-semibold text-black shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition hover:-translate-y-px hover:shadow-[0_18px_44px_rgba(0,0,0,0.45)] active:translate-y-0 active:shadow-[0_10px_30px_rgba(0,0,0,0.35)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? <Spinner /> : <Chrome className="h-4 w-4" aria-hidden="true" />}
          Continue with Google
        </button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[12px] font-medium text-white/40">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={handleEmailSignUp} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
              NAME <span className="font-medium text-white/30">(OPTIONAL)</span>
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-4 top-[18px] h-4 w-4 text-white/30" aria-hidden="true" />
              <input
                className={`${inputClassName} pl-11`}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
              EMAIL
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-[18px] h-4 w-4 text-white/30" aria-hidden="true" />
              <input
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
              <input
                className={`${inputClassName} pr-11`}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-white/50 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isBusy}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold tracking-[0.22em] text-white/50">
              CONFIRM PASSWORD
            </label>
            <input
              className={inputClassName}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
          </div>

          <p className="text-[12px] leading-relaxed text-white/45">
            By creating an account, you agree to our{' '}
            <Link to="/privacy-policy" className="text-white/70 hover:text-white hover:underline">
              privacy policy
            </Link>
            .
          </p>

          <button
            type="submit"
            disabled={isBusy}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-gradient-to-r from-accent-500 via-fuchsia-500 to-blue-500 px-4 text-[14px] font-semibold text-white shadow-[0_18px_40px_rgba(255,56,92,0.20)] transition hover:-translate-y-px hover:shadow-[0_26px_64px_rgba(168,85,247,0.22)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy ? <Spinner /> : null}
            Create account
          </button>
        </form>
      </div>
    </AuthShell>
  );
}

