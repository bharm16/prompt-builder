/**
 * Client-side feature flags.
 *
 * Flags are declared here with metadata so they appear in the generated
 * flag documentation. The legacy pre-canvas layout branch remains exercised
 * by PromptOptimizerWorkspaceView.test.tsx — keep both branches alive until
 * the layout migration is formally concluded.
 */

interface ClientFlagDef<T> {
  envName: string;
  default: T;
  description: string;
  /** If true, this flag has no in-app "off" path beyond the legacy code branch. */
  migrationFlag?: boolean;
}

const FLAG_DEFS = {
  CANVAS_FIRST_LAYOUT: {
    envName: "VITE_FEATURE_CANVAS_FIRST_LAYOUT",
    default: true,
    description:
      "Renders the canvas-first workspace. Set to 'false' to fall back to the legacy sidebar layout.",
    migrationFlag: true,
  } satisfies ClientFlagDef<boolean>,
} as const;

function resolveBoolFlag(envName: string, fallback: boolean): boolean {
  // import.meta.env is Vite-specific; guard so this module stays importable
  // from Node tooling (e.g. the flag documentation generator).
  const env =
    typeof import.meta !== "undefined"
      ? (import.meta as { env?: Record<string, string | undefined> }).env
      : undefined;
  const raw = env?.[envName];
  if (raw === "false") return false;
  if (raw === "true") return true;
  return fallback;
}

export const FEATURES = {
  CANVAS_FIRST_LAYOUT: resolveBoolFlag(
    FLAG_DEFS.CANVAS_FIRST_LAYOUT.envName,
    FLAG_DEFS.CANVAS_FIRST_LAYOUT.default,
  ),
} as const;

/** Metadata used by the flag documentation generator. Runtime code should read FEATURES. */
export const CLIENT_FLAG_METADATA = FLAG_DEFS;
