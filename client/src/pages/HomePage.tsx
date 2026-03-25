import { type ReactElement } from "react";
import { Link } from "react-router-dom";
import { useAuthUser } from "@hooks/useAuthUser";
import { AUTH_COLORS } from "./auth/auth-styles";

export function HomePage(): ReactElement {
  const user = useAuthUser();

  return (
    <div
      className="h-full overflow-y-auto"
      style={{ background: AUTH_COLORS.bg }}
    >
      <div className="mx-auto max-w-md px-4 sm:px-6 pt-24 pb-16 text-center">
        <p
          className="text-[10px] font-semibold tracking-[0.2em]"
          style={{ color: AUTH_COLORS.textLabel }}
        >
          VIDRA
        </p>
        <h1 className="mt-2 text-[18px] font-semibold text-white tracking-tight">
          Better prompts. Better video.
        </h1>
        <p
          className="mt-2 text-[13px] leading-relaxed"
          style={{ color: AUTH_COLORS.textSecondary }}
        >
          Optimize your AI video prompts for Sora, Veo, Runway, and more.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <Link
            to="/"
            className="inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold transition"
            style={{ background: AUTH_COLORS.accent, color: AUTH_COLORS.bg }}
          >
            Open workspace
          </Link>
          {!user && (
            <Link
              to="/signup"
              className="inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold text-white transition"
              style={{
                background: AUTH_COLORS.card,
                border: `1px solid ${AUTH_COLORS.cardBorder}`,
              }}
            >
              Create account
            </Link>
          )}
        </div>
        <div
          className="mt-8 flex items-center justify-center gap-x-4 text-[12px]"
          style={{ color: AUTH_COLORS.textDim }}
        >
          <Link to="/docs" className="hover:text-white transition-colors">
            Docs
          </Link>
          <Link to="/pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link to="/contact" className="hover:text-white transition-colors">
            Support
          </Link>
        </div>
      </div>
    </div>
  );
}
