import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail } from "@promptstudio/system/components/ui";
import { getAuthRepository } from "@repositories/index";
import { useToast } from "@components/Toast";
import { Button } from "@promptstudio/system/components/ui/button";
import { Input } from "@promptstudio/system/components/ui/input";
import { AuthShell } from "./auth/AuthShell";
import {
  AUTH_COLORS,
  AUTH_INPUT_CLASS,
  AUTH_INPUT_STYLE,
  AUTH_INPUT_FOCUS_STYLE,
  AUTH_CTA_CLASS,
  AUTH_CTA_STYLE,
  AUTH_LABEL_CLASS,
  AUTH_ERROR_STYLE,
  AUTH_CARD_STYLE,
} from "./auth/auth-styles";

function getSafeRedirect(search: string): string | null {
  const params = new URLSearchParams(search);
  const raw = params.get("redirect");
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  return raw;
}

function getInitialEmail(search: string): string {
  const params = new URLSearchParams(search);
  const raw = params.get("email");
  if (!raw) return "";
  return raw.trim();
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

function mapAuthError(error: unknown): string {
  if (!error || typeof error !== "object")
    return "Something went wrong. Please try again.";
  const code =
    "code" in error && typeof error.code === "string" ? error.code : null;

  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
      return "No account found for that email.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a bit.";
    case "auth/unauthorized-continue-uri":
    case "auth/invalid-continue-uri":
    case "auth/missing-continue-uri":
      return "Password reset links aren't configured for this domain yet.";
    default:
      return "Failed to send reset email. Please try again.";
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

export function ForgotPasswordPage(): React.ReactElement {
  const toast = useToast();
  const location = useLocation();
  const redirect = getSafeRedirect(location.search);

  const [email, setEmail] = React.useState(() =>
    getInitialEmail(location.search),
  );
  const [isBusy, setIsBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sentTo, setSentTo] = React.useState<string | null>(null);

  const emailFocus = useFocusStyle();

  React.useEffect(() => {
    setEmail(getInitialEmail(location.search));
    setSentTo(null);
    setError(null);
  }, [location.search]);

  const handleSend = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    const normalizedEmail = email.trim();

    setError(null);
    setSentTo(null);

    if (!normalizedEmail) {
      setError("Enter your email address.");
      return;
    }

    setIsBusy(true);
    try {
      await getAuthRepository().sendPasswordReset(
        normalizedEmail,
        redirect ?? undefined,
      );
      setSentTo(normalizedEmail);
      toast.success("Password reset email sent.");
    } catch (err) {
      setError(mapAuthError(err));
      toast.error("Failed to send reset email.");
    } finally {
      setIsBusy(false);
    }
  };

  const signInLink = redirect
    ? `/signin?redirect=${encodeURIComponent(redirect)}`
    : "/signin";

  return (
    <AuthShell
      title="Reset your password"
      footer={
        <>
          Remembered it?{" "}
          <Link to={signInLink} className="text-white hover:underline">
            Back to sign in
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
          Enter the email for your account. If it exists, we'll send a reset
          link.
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

        {sentTo ? (
          <div className="px-3.5 py-3" style={AUTH_CARD_STYLE}>
            <p className="text-[13px] font-semibold text-white">
              Check your inbox
            </p>
            <p
              className="mt-1 text-[13px] leading-snug"
              style={{ color: AUTH_COLORS.textSecondary }}
            >
              We sent a reset link to{" "}
              <span className="font-medium text-white">{sentTo}</span>. If you
              don't see it, check spam.
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSend} className="flex flex-col gap-3.5">
          <div>
            <label
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
                disabled={isBusy}
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isBusy}
            variant="ghost"
            className={AUTH_CTA_CLASS}
            style={AUTH_CTA_STYLE}
          >
            {isBusy ? <Spinner /> : null}
            Send reset email
          </Button>

          <div className="flex items-center justify-between gap-3">
            <Link
              to={signInLink}
              className="text-[12px] font-medium transition hover:text-white"
              style={{ color: AUTH_COLORS.textDim }}
            >
              Back to sign in
            </Link>
            <Link
              to="/privacy-policy"
              className="text-[12px] font-medium transition hover:text-white"
              style={{ color: AUTH_COLORS.textLabel }}
            >
              Privacy
            </Link>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
