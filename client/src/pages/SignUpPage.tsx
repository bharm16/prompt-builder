import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Chrome, Eye, EyeOff, Mail, User as UserIcon } from '@promptstudio/system/components/ui';
import { getAuthRepository } from '@repositories/index';
import { useToast } from '@components/Toast';
import { Button } from '@promptstudio/system/components/ui/button';
import { Input } from '@promptstudio/system/components/ui/input';
import { useAuthUser } from '@hooks/useAuthUser';
import { AuthShell } from './auth/AuthShell';
import {
  AUTH_COLORS,
  AUTH_INPUT_CLASS,
  AUTH_INPUT_STYLE,
  AUTH_INPUT_FOCUS_STYLE,
  AUTH_CTA_CLASS,
  AUTH_CTA_STYLE,
  AUTH_SECONDARY_BTN_CLASS,
  AUTH_SECONDARY_BTN_STYLE,
  AUTH_LABEL_CLASS,
  AUTH_ERROR_STYLE,
  AUTH_DIVIDER_STYLE,
} from './auth/auth-styles';

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
    case 'auth/email-already-in-use':
      return 'That email is already in use. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 6 characters.';
    case 'auth/operation-not-allowed':
      return flow === 'google'
        ? 'Google sign-in is disabled in Firebase Auth. Enable the Google provider in the Firebase console.'
        : 'Email/password sign-up is disabled in Firebase Auth.';
    case 'auth/popup-blocked':
      return 'Google popup was blocked. Allow popups for this tab and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google popup was closed before sign-up completed.';
    case 'auth/cancelled-popup-request':
      return 'Google sign-up popup request was cancelled. Try again.';
    case 'auth/unauthorized-domain':
      return 'This localhost domain is not authorized in Firebase Auth settings.';
    case 'auth/operation-not-supported-in-this-environment':
    case 'auth/web-storage-unsupported':
      return 'Google sign-in is not supported in this embedded browser. Use email sign-up here or open the app in a regular browser.';
    default:
      return 'Failed to create account. Please try again.';
  }
}

function secureEquals(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let i = 0; i < maxLength; i++) {
    diff |= (leftBytes[i] ?? 0) ^ (rightBytes[i] ?? 0);
  }

  return diff === 0;
}

function useFocusStyle(): {
  style: React.CSSProperties;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [focused, setFocused] = React.useState(false);
  return {
    style: focused ? { ...AUTH_INPUT_STYLE, ...AUTH_INPUT_FOCUS_STYLE } : AUTH_INPUT_STYLE,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}

export function SignUpPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);
  const signInLink = redirect ? `/signin?redirect=${encodeURIComponent(redirect)}` : '/signin';
  const suppressAutoRedirect = React.useRef(false);

  const user = useAuthUser();
  const [displayName, setDisplayName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPassword, setShowPassword] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const nameFocus = useFocusStyle();
  const emailFocus = useFocusStyle();
  const passwordFocus = useFocusStyle();
  const confirmFocus = useFocusStyle();

  React.useEffect(() => {
    if (!user) return;
    if (suppressAutoRedirect.current) return;
    if (redirect) {
      navigate(redirect, { replace: true });
      return;
    }
    navigate('/', { replace: true });
  }, [navigate, redirect, user]);

  const handleGoogleSignUp = async (): Promise<void> => {
    suppressAutoRedirect.current = true;
    setError(null);
    setIsBusy(true);
    try {
      const signedInUser = await getAuthRepository().signInWithGoogle();
      const name =
        typeof signedInUser.displayName === 'string' ? signedInUser.displayName : 'there';
      toast.success(`Welcome, ${name}!`);
      navigate(redirect ?? '/', { replace: true });
    } catch (err) {
      setError(mapAuthError(err, 'google'));
      toast.error('Failed to create account. Please try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const handleEmailSignUp = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    suppressAutoRedirect.current = true;
    setError(null);
    setIsBusy(true);
    try {
      const normalizedEmail = email.trim();
      const normalizedName = displayName.trim();

      if (!normalizedEmail || !password) {
        setError('Enter your email and password.');
        return;
      }
      if (!secureEquals(password, confirmPassword)) {
        setError('Passwords do not match.');
        return;
      }

      const newUser = await getAuthRepository().signUpWithEmail(normalizedEmail, password, normalizedName);
      const name = typeof newUser.displayName === 'string' ? newUser.displayName : 'there';
      toast.success(`Account created. Welcome, ${name}!`);
      let delivery: 'sent' | 'failed' = 'sent';

      try {
        await getAuthRepository().sendVerificationEmail(redirect ?? undefined);
      } catch {
        delivery = 'failed';
      }

      const params = new URLSearchParams();
      if (redirect) params.set('redirect', redirect);
      if (normalizedEmail) params.set('email', normalizedEmail);
      const query = params.toString();
      navigate(query ? `/email-verification?${query}` : '/email-verification', {
        replace: true,
        state: { delivery },
      });
    } catch (err) {
      setError(mapAuthError(err, 'email'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create account"
      footer={
        <>
          Already have an account?{' '}
          <Link to={signInLink} className="text-white hover:underline">
            Sign in
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed" style={{ color: AUTH_COLORS.textSecondary }}>
          Create an account to sync history, save versions, and pick up where you left off.
        </p>

        {error ? (
          <div role="alert" className="px-3.5 py-2.5 text-[13px]" style={AUTH_ERROR_STYLE}>
            <span style={{ color: AUTH_COLORS.danger }}>{error}</span>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={isBusy}
          variant="ghost"
          className={AUTH_SECONDARY_BTN_CLASS}
          style={AUTH_SECONDARY_BTN_STYLE}
        >
          {isBusy ? <Spinner /> : <Chrome className="h-4 w-4" aria-hidden="true" />}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1" style={AUTH_DIVIDER_STYLE} />
          <span className="text-[11px] font-medium" style={{ color: AUTH_COLORS.textLabel }}>or</span>
          <div className="flex-1" style={AUTH_DIVIDER_STYLE} />
        </div>

        <form onSubmit={handleEmailSignUp} className="flex flex-col gap-3.5">
          <div>
            <label className={AUTH_LABEL_CLASS} style={{ color: AUTH_COLORS.textLabel }}>
              NAME <span style={{ color: AUTH_COLORS.textPlaceholder }}>(OPTIONAL)</span>
            </label>
            <div className="relative">
              <UserIcon className="pointer-events-none absolute left-3.5 top-[14px] h-4 w-4" style={{ color: AUTH_COLORS.textPlaceholder }} aria-hidden="true" />
              <Input
                className={`${AUTH_INPUT_CLASS} pl-10`}
                style={nameFocus.style}
                onFocus={nameFocus.onFocus}
                onBlur={nameFocus.onBlur}
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
          </div>

          <div>
            <label className={AUTH_LABEL_CLASS} style={{ color: AUTH_COLORS.textLabel }}>
              EMAIL
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-[14px] h-4 w-4" style={{ color: AUTH_COLORS.textPlaceholder }} aria-hidden="true" />
              <Input
                className={`${AUTH_INPUT_CLASS} pl-10`}
                style={emailFocus.style}
                onFocus={emailFocus.onFocus}
                onBlur={emailFocus.onBlur}
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
            <label className={AUTH_LABEL_CLASS} style={{ color: AUTH_COLORS.textLabel }}>
              PASSWORD
            </label>
            <div className="relative">
              <Input
                className={`${AUTH_INPUT_CLASS} pr-10`}
                style={passwordFocus.style}
                onFocus={passwordFocus.onFocus}
                onBlur={passwordFocus.onBlur}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="At least 6 characters"
              />
              <Button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md p-0 transition"
                style={{ color: AUTH_COLORS.textPlaceholder }}
                disabled={isBusy}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Eye className="h-3.5 w-3.5" aria-hidden="true" />}
              </Button>
            </div>
          </div>

          <div>
            <label className={AUTH_LABEL_CLASS} style={{ color: AUTH_COLORS.textLabel }}>
              CONFIRM PASSWORD
            </label>
            <Input
              className={AUTH_INPUT_CLASS}
              style={confirmFocus.style}
              onFocus={confirmFocus.onFocus}
              onBlur={confirmFocus.onBlur}
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
          </div>

          <p className="text-[12px] leading-relaxed" style={{ color: AUTH_COLORS.textLabel }}>
            By creating an account, you agree to our{' '}
            <Link to="/terms-of-service" className="hover:text-white hover:underline" style={{ color: AUTH_COLORS.textDim }}>
              terms
            </Link>{' '}
            and{' '}
            <Link to="/privacy-policy" className="hover:text-white hover:underline" style={{ color: AUTH_COLORS.textDim }}>
              privacy policy
            </Link>
            .
          </p>

          <Button
            type="submit"
            disabled={isBusy}
            variant="ghost"
            className={AUTH_CTA_CLASS}
            style={AUTH_CTA_STYLE}
          >
            {isBusy ? <Spinner /> : null}
            Create account
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
