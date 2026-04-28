import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Chrome, Eye, EyeOff, Mail } from "@promptstudio/system/components/ui";
import { getAuthRepository } from "@repositories/index";
import { useToast } from "@components/Toast";
import { Button } from "@promptstudio/system/components/ui/button";
import { Input } from "@promptstudio/system/components/ui/input";
import { useAuthUser } from "@hooks/useAuthUser";
import { AuthShell } from "./auth/AuthShell";
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
} from "./auth/auth-styles";

function getSafeRedirect(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("redirect");
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

function Spinner(): React.ReactElement {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

type AuthFlow = "google" | "email";

function mapAuthError(error: unknown, flow: AuthFlow): string {
  if (!error || typeof error !== "object")
    return "Something went wrong. Please try again.";
  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;

  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-disabled":
      return "This account is disabled.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a bit.";
    case "auth/operation-not-allowed":
      return flow === "google"
        ? "Google sign-in is disabled in Firebase Auth. Enable the Google provider in the Firebase console."
        : "Email/password sign-in is disabled in Firebase Auth.";
    case "auth/popup-blocked":
      return "Google popup was blocked. Allow popups for this tab and try again.";
    case "auth/popup-closed-by-user":
      return "Google popup was closed before sign-in completed.";
    case "auth/cancelled-popup-request":
      return "Google sign-in popup request was cancelled. Try again.";
    case "auth/unauthorized-domain":
      return "This localhost domain is not authorized in Firebase Auth settings.";
    case "auth/operation-not-supported-in-this-environment":
    case "auth/web-storage-unsupported":
      return "Google sign-in is not supported in this embedded browser. Use email sign-in here or open the app in a regular browser.";
    default:
      return "Failed to sign in. Please try again.";
  }
}

function useFocusStyle(): {
  style: React.CSSProperties;
  onFocus: () => void;
  onBlur: () => void;
} {
  const [focused, setFocused] = React.useState(false);
  return {
    style: focused
      ? { ...AUTH_INPUT_STYLE, ...AUTH_INPUT_FOCUS_STYLE }
      : AUTH_INPUT_STYLE,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}

export function SignInPage(): React.ReactElement {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);
  const signUpLink = redirect
    ? `/signup?redirect=${encodeURIComponent(redirect)}`
    : "/signup";

  const user = useAuthUser();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const emailFocus = useFocusStyle();
  const passwordFocus = useFocusStyle();
  const emailId = React.useId();
  const passwordId = React.useId();

  React.useEffect(() => {
    if (!user) return;
    if (redirect) {
      navigate(redirect, { replace: true });
      return;
    }
    navigate("/", { replace: true });
  }, [navigate, redirect, user]);

  const handleGoogleSignIn = async (): Promise<void> => {
    setError(null);
    setIsBusy(true);
    try {
      const signedInUser = await getAuthRepository().signInWithGoogle();
      const displayName =
        typeof signedInUser.displayName === "string"
          ? signedInUser.displayName
          : "User";
      toast.success(`Welcome, ${displayName}!`);
      navigate(redirect ?? "/", { replace: true });
    } catch (err) {
      setError(mapAuthError(err, "google"));
      toast.error("Failed to sign in. Please try again.");
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
        setError("Enter your email and password.");
        return;
      }

      const signedInUser = await getAuthRepository().signInWithEmail(
        normalizedEmail,
        password,
      );
      const displayName =
        typeof signedInUser.displayName === "string"
          ? signedInUser.displayName
          : "User";
      toast.success(`Welcome back, ${displayName}!`);
      navigate(redirect ?? "/", { replace: true });
    } catch (err) {
      setError(mapAuthError(err, "email"));
    } finally {
      setIsBusy(false);
    }
  };

  const forgotPasswordLink = React.useMemo(() => {
    const params = new URLSearchParams();
    if (redirect) params.set("redirect", redirect);
    const normalizedEmail = email.trim();
    if (normalizedEmail) params.set("email", normalizedEmail);
    const query = params.toString();
    return query ? `/forgot-password?${query}` : "/forgot-password";
  }, [email, redirect]);

  return (
    <AuthShell
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link to={signUpLink} className="text-white hover:underline">
            Create an account
          </Link>
          .
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p
          className="text-[13px] leading-relaxed"
          style={{ color: AUTH_COLORS.textSecondary }}
        >
          Sign in to sync prompt history and keep your work across devices.
        </p>

        {error ? (
          <div
            role="alert"
            className="px-3.5 py-2.5 text-[13px]"
            style={AUTH_ERROR_STYLE}
          >
            <span style={{ color: AUTH_COLORS.danger }}>{error}</span>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isBusy}
          variant="ghost"
          className={AUTH_SECONDARY_BTN_CLASS}
          style={AUTH_SECONDARY_BTN_STYLE}
        >
          {isBusy ? (
            <Spinner />
          ) : (
            <Chrome className="h-4 w-4" aria-hidden="true" />
          )}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex-1" style={AUTH_DIVIDER_STYLE} />
          <span
            className="text-[11px] font-medium"
            style={{ color: AUTH_COLORS.textLabel }}
          >
            or
          </span>
          <div className="flex-1" style={AUTH_DIVIDER_STYLE} />
        </div>

        <form onSubmit={handleEmailSignIn} className="flex flex-col gap-3.5">
          <div>
            <label
              htmlFor={emailId}
              className={AUTH_LABEL_CLASS}
              style={{ color: AUTH_COLORS.textLabel }}
            >
              EMAIL
            </label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3.5 top-[14px] h-4 w-4"
                style={{ color: AUTH_COLORS.textPlaceholder }}
                aria-hidden="true"
              />
              <Input
                id={emailId}
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
            <label
              htmlFor={passwordId}
              className={AUTH_LABEL_CLASS}
              style={{ color: AUTH_COLORS.textLabel }}
            >
              PASSWORD
            </label>
            <div className="relative">
              <Input
                id={passwordId}
                className={`${AUTH_INPUT_CLASS} pr-10`}
                style={passwordFocus.style}
                onFocus={passwordFocus.onFocus}
                onBlur={passwordFocus.onBlur}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
              <Button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 rounded-md p-0 transition"
                style={{ color: AUTH_COLORS.textPlaceholder }}
                disabled={isBusy}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Link
              to={forgotPasswordLink}
              className="text-[12px] font-medium transition hover:text-white"
              style={{ color: AUTH_COLORS.textDim }}
            >
              Forgot password?
            </Link>
            <Link
              to="/privacy-policy"
              className="text-[12px] font-medium transition hover:text-white"
              style={{ color: AUTH_COLORS.textLabel }}
            >
              Privacy
            </Link>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            variant="ghost"
            className={AUTH_CTA_CLASS}
            style={AUTH_CTA_STYLE}
          >
            {isBusy ? <Spinner /> : null}
            Sign in
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
