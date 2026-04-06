import { useMemo, type ReactElement } from "react";
import { GridFour, Home } from "@promptstudio/system/components/ui";
import { Link, useLocation } from "react-router-dom";
import { useBillingStatus } from "@/features/billing/hooks/useBillingStatus";
import { ToolNavButton } from "./ToolNavButton";
import { toolNavItems } from "../config/toolNavConfig";
import type { ToolRailProps } from "../types";

export function ToolRail({
  activePanel,
  onPanelChange,
  onGalleryToggle,
  user,
}: ToolRailProps): ReactElement {
  const location = useLocation();
  const { status, isLoading: isLoadingStatus } = useBillingStatus();
  const sessionsItem = toolNavItems.find((item) => item.variant === "header");
  const navItems = toolNavItems.filter((item) => item.variant === "default");
  const photoURL = typeof user?.photoURL === "string" ? user.photoURL : null;
  const displayName =
    typeof user?.displayName === "string" ? user.displayName.trim() : "";
  const email = typeof user?.email === "string" ? user.email.trim() : "";
  const initial = (displayName || email || "U").slice(0, 1).toUpperCase();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const userActionLink = user ? "/account" : `/signin?redirect=${returnTo}`;
  const userActionLabel = user ? "Account" : "Sign in";
  const planLabel = useMemo((): string => {
    if (isLoadingStatus) return "…";
    if (!user) return "Sign in";
    if (!status?.isSubscribed) return "Free";
    const tier = status.planTier;
    if (!tier) return "Free";
    return tier.charAt(0).toUpperCase() + tier.slice(1);
  }, [user, status, isLoadingStatus]);

  // Keep planLabel referenced to avoid lint unused-variable error
  void planLabel;

  const handlePanelChange = (panelId: typeof activePanel): void => {
    if (panelId === "sessions") {
      // Toggle sessions — if already viewing sessions, go back to studio
      onPanelChange(activePanel === "sessions" ? "studio" : "sessions");
      return;
    }
    onPanelChange(panelId);
  };

  return (
    <aside
      className="flex h-full w-[52px] flex-none flex-col items-center border-r border-tool-rail-border bg-tool-rail-bg px-1.5 py-3"
      aria-label="Tool navigation"
    >
      <div className="flex h-8 w-8 items-center justify-center">
        <span className="text-[15px] font-bold text-foreground">V</span>
      </div>

      <div
        className="my-1.5 h-px w-6 bg-tool-rail-border"
        aria-hidden="true"
      />

      {/* ── Nav items: Tool, Apps, Chars, Styles ── */}
      <nav
        className="flex flex-col items-center gap-0.5"
        aria-label="Tool panels"
      >
        {navItems.map((item) => (
          <ToolNavButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            isActive={activePanel === item.id}
            onClick={() => handlePanelChange(item.id)}
          />
        ))}
        <ToolNavButton
          icon={GridFour}
          label="Gallery"
          isActive={false}
          onClick={() => {
            onPanelChange("studio");
            onGalleryToggle?.();
          }}
        />
        <div
          className="my-1.5 h-px w-6 bg-tool-rail-border"
          aria-hidden="true"
        />
        {sessionsItem ? (
          <ToolNavButton
            icon={sessionsItem.icon}
            label={sessionsItem.label}
            isActive={activePanel === "sessions"}
            onClick={() => handlePanelChange("sessions")}
            variant="header"
          />
        ) : null}
      </nav>

      <div className="flex-1" />

      {/* ── Bottom: Home + Profile ── */}
      <div className="flex flex-col items-center gap-1 pb-2">
        <Link
          to="/home"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-tool-text-muted transition-colors hover:bg-tool-nav-hover hover:text-tool-text-primary"
          aria-label="Home"
          title="Home"
        >
          <Home size={20} weight="regular" />
        </Link>

        <div
          className="my-1.5 h-px w-6 bg-tool-rail-border"
          aria-hidden="true"
        />

        {/* ── Profile avatar ── */}
        <Link
          to={userActionLink}
          className="flex h-8 w-8 items-center justify-center"
          aria-label={userActionLabel}
          title={displayName || email || "Account"}
        >
          {photoURL ? (
            <img
              src={photoURL}
              alt=""
              className="h-8 w-8 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
              <span className="text-body-sm font-bold text-white">
                {initial}
              </span>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}
