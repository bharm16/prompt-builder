/**
 * Single source of truth for server feature flags.
 *
 * Every boolean/enum toggle the server honors is declared here with a canonical
 * env var name, default value, and (optionally) legacy aliases kept alive for
 * back-compat. Non-flag scalars (ports, timeouts, URLs, API keys) are NOT in
 * scope — those stay in env.ts as Zod-validated config.
 *
 * This file must remain free of infrastructure imports (no logger, no DI).
 * It is consumed from early-boot code paths where those may not be ready.
 */

export type FlagCategory =
  | "mode"
  | "worker"
  | "killswitch"
  | "provider"
  | "experimental"
  | "debug";

export interface FlagAlias {
  envName: string;
  /**
   * When true, the alias lives in the opposite truth-space from the canonical
   * flag. Used for the `*_DISABLED` → `*_ENABLED` rename: legacy alias value
   * "true" means the new flag resolves to `false`.
   */
  inverted?: boolean;
}

interface BaseFlagDef {
  envName: string;
  description: string;
  category: FlagCategory;
  aliases?: readonly FlagAlias[];
}

export interface BoolFlagDef extends BaseFlagDef {
  kind: "bool";
  default: boolean;
  /**
   * When true, the flag is resolved as the logical OR of the canonical env
   * AND every alias (instead of canonical-wins-over-alias). Used to preserve
   * historical `isTrue(X) || isTrue(Y)` semantics for flags that accepted
   * multiple equivalent env names before consolidation.
   */
  unionWithAliases?: boolean;
}

export interface EnumFlagDef<T extends string = string> extends BaseFlagDef {
  kind: "enum";
  values: readonly T[];
  default: T;
}

export type FlagDef = BoolFlagDef | EnumFlagDef;

export interface FlagResolution<T> {
  value: T;
  /** "default" when nothing was set; "env" when the canonical name was; "alias" when a legacy name was. */
  source: "default" | "env" | "alias";
  /** The env var name that actually provided the value (empty when source === "default"). */
  sourceName: string;
  /** Populated when an alias was used — caller should log as a deprecation warning. */
  deprecationNotice?: string;
}

// ─── Flag registry ─────────────────────────────────────────────────

const MODE_FLAGS = {
  convergence: {
    kind: "bool",
    envName: "ENABLE_CONVERGENCE",
    default: true,
    description:
      "Enables continuity/convergence services. When false, continuitySessionService resolves to null.",
    category: "mode",
  },
} as const satisfies Record<string, FlagDef>;

const WORKER_FLAGS = {
  videoJobWorkerDisabled: {
    kind: "bool",
    envName: "VIDEO_JOB_WORKER_DISABLED",
    default: false,
    description:
      "Forces video worker loops off even when PROCESS_ROLE=worker. Used for emergency drain.",
    category: "worker",
  },
} as const satisfies Record<string, FlagDef>;

/**
 * Kill switches for background services. Canonical naming is `*_ENABLED`
 * (default `true`) — the legacy `*_DISABLED` env vars are accepted via
 * aliases with `inverted: true`.
 */
const KILLSWITCH_FLAGS = {
  webhookReconciliationEnabled: {
    kind: "bool",
    envName: "WEBHOOK_RECONCILIATION_ENABLED",
    default: true,
    description: "Stripe webhook reconciliation background service.",
    category: "killswitch",
    aliases: [{ envName: "WEBHOOK_RECONCILIATION_DISABLED", inverted: true }],
  },
  billingProfileRepairEnabled: {
    kind: "bool",
    envName: "BILLING_PROFILE_REPAIR_ENABLED",
    default: true,
    description: "Billing profile repair background worker.",
    category: "killswitch",
    aliases: [{ envName: "BILLING_PROFILE_REPAIR_DISABLED", inverted: true }],
  },
  creditRefundSweeperEnabled: {
    kind: "bool",
    envName: "CREDIT_REFUND_SWEEPER_ENABLED",
    default: true,
    description: "Credit refund sweeper background service.",
    category: "killswitch",
    aliases: [{ envName: "CREDIT_REFUND_SWEEPER_DISABLED", inverted: true }],
  },
  creditReconciliationEnabled: {
    kind: "bool",
    envName: "CREDIT_RECONCILIATION_ENABLED",
    default: true,
    description: "Credit reconciliation background service.",
    category: "killswitch",
    aliases: [{ envName: "CREDIT_RECONCILIATION_DISABLED", inverted: true }],
  },
  videoJobSweeperEnabled: {
    kind: "bool",
    envName: "VIDEO_JOB_SWEEPER_ENABLED",
    default: true,
    description: "Video job stale-task sweeper.",
    category: "killswitch",
    aliases: [{ envName: "VIDEO_JOB_SWEEPER_DISABLED", inverted: true }],
  },
  videoDlqReprocessorEnabled: {
    kind: "bool",
    envName: "VIDEO_DLQ_REPROCESSOR_ENABLED",
    default: true,
    description: "Dead-letter-queue reprocessor for failed video jobs.",
    category: "killswitch",
    aliases: [{ envName: "VIDEO_DLQ_REPROCESSOR_DISABLED", inverted: true }],
  },
  videoAssetRetentionEnabled: {
    kind: "bool",
    envName: "VIDEO_ASSET_RETENTION_ENABLED",
    default: true,
    description: "Video asset cleanup/retention service.",
    category: "killswitch",
    aliases: [{ envName: "VIDEO_ASSET_RETENTION_DISABLED", inverted: true }],
  },
  /**
   * Orphan-detection reconciler. Legacy env var `VIDEO_ASSET_RECONCILER_DISABLED`
   * used `!== "false"` — i.e. off-by-default with `_DISABLED=false` as the
   * explicit opt-in. Canonical form flips to `_ENABLED=true` as opt-in while
   * preserving the default-off behavior.
   */
  videoAssetReconcilerEnabled: {
    kind: "bool",
    envName: "VIDEO_ASSET_RECONCILER_ENABLED",
    default: false,
    description:
      "Video asset orphan-detection reconciler. Opt-in (default off).",
    category: "killswitch",
    aliases: [{ envName: "VIDEO_ASSET_RECONCILER_DISABLED", inverted: true }],
  },
} as const satisfies Record<string, FlagDef>;

const PROVIDER_FLAGS = {
  allowUnhealthyGemini: {
    kind: "bool",
    envName: "ALLOW_UNHEALTHY_GEMINI",
    default: false,
    description:
      "Use Gemini even when the provider health check fails. Useful for dev/debug; not recommended in production.",
    category: "provider",
    // GEMINI_ALLOW_UNHEALTHY was an unintentional duplicate — keep it working
    // as an alias. Historical behavior was `isTrue(X) || isTrue(Y)` — either
    // name set to "true" enables. `unionWithAliases` preserves that exactly.
    aliases: [{ envName: "GEMINI_ALLOW_UNHEALTHY" }],
    unionWithAliases: true,
  },
} as const satisfies Record<string, FlagDef>;

const EXPERIMENTAL_FLAGS = {
  faceEmbeddingEnabled: {
    kind: "bool",
    envName: "ENABLE_FACE_EMBEDDING",
    default: false,
    description:
      "Enables face embedding service for continuity quality gates. Requires Replicate API token.",
    category: "experimental",
  },
  continuityClipEnabled: {
    kind: "bool",
    envName: "CONTINUITY_CLIP_ENABLED",
    default: true,
    description: "Enables CLIP embedding in continuity quality gate checks.",
    category: "experimental",
    aliases: [{ envName: "DISABLE_CONTINUITY_CLIP", inverted: true }],
  },
  // Note: FAL_DEPTH_WARMUP_ENABLED is intentionally NOT in this registry.
  // Its effective default depends on NODE_ENV (true in dev, false in prod),
  // which can't be modeled with the registry's static defaults. It is
  // resolved inline in core.services.ts via resolveBoolFlag.
  depthWarmupOnStartup: {
    kind: "bool",
    envName: "DEPTH_WARMUP_ON_STARTUP",
    default: true,
    description: "Controls depth estimation service warmup during server boot.",
    category: "experimental",
  },
} as const satisfies Record<string, FlagDef>;

const DEBUG_FLAGS = {
  unhandledRejectionMode: {
    kind: "enum",
    envName: "UNHANDLED_REJECTION_MODE",
    values: ["classified", "strict"] as const,
    default: "classified",
    description:
      "How unhandled promise rejections are categorized. `strict` exits the process; `classified` logs and continues.",
    category: "debug",
  },
} as const satisfies Record<string, FlagDef>;

export const FLAG_DEFINITIONS = {
  ...MODE_FLAGS,
  ...WORKER_FLAGS,
  ...KILLSWITCH_FLAGS,
  ...PROVIDER_FLAGS,
  ...EXPERIMENTAL_FLAGS,
  ...DEBUG_FLAGS,
} as const;

export type FlagName = keyof typeof FLAG_DEFINITIONS;

// ─── Resolution ────────────────────────────────────────────────────

function parseBool(raw: string): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

function resolveBoolFlag(
  def: BoolFlagDef,
  env: NodeJS.ProcessEnv,
): FlagResolution<boolean> {
  // Union-mode: preserve historical `isTrue(X) || isTrue(Y)` semantics where
  // any listed name set to "true" enables the flag. Used only by flags whose
  // pre-consolidation behavior was OR-across-names (e.g. allowUnhealthyGemini).
  if (def.unionWithAliases) {
    let anyAliasSeen: string | undefined;
    const canonicalParsed = parseBool(env[def.envName] ?? "");
    if (canonicalParsed === true) {
      return { value: true, source: "env", sourceName: def.envName };
    }
    for (const alias of def.aliases ?? []) {
      const parsed = parseBool(env[alias.envName] ?? "");
      if (parsed === true) {
        return {
          value: true,
          source: "alias",
          sourceName: alias.envName,
          deprecationNotice: `Env var "${alias.envName}" is deprecated. Use "${def.envName}" instead.`,
        };
      }
      if (env[alias.envName] !== undefined && anyAliasSeen === undefined) {
        anyAliasSeen = alias.envName;
      }
    }
    // Nothing evaluated to true — return default. Still surface a deprecation
    // if only the legacy name was set (even to "false").
    if (anyAliasSeen !== undefined && canonicalParsed === undefined) {
      return {
        value: def.default,
        source: "alias",
        sourceName: anyAliasSeen,
        deprecationNotice: `Env var "${anyAliasSeen}" is deprecated. Use "${def.envName}" instead.`,
      };
    }
    return { value: def.default, source: "default", sourceName: "" };
  }

  const canonical = env[def.envName];
  if (canonical !== undefined) {
    const parsed = parseBool(canonical);
    if (parsed !== undefined) {
      return { value: parsed, source: "env", sourceName: def.envName };
    }
  }

  for (const alias of def.aliases ?? []) {
    const raw = env[alias.envName];
    if (raw === undefined) continue;
    const parsed = parseBool(raw);
    if (parsed === undefined) continue;
    const value = alias.inverted ? !parsed : parsed;
    return {
      value,
      source: "alias",
      sourceName: alias.envName,
      deprecationNotice: `Env var "${alias.envName}" is deprecated. Use "${def.envName}" instead${
        alias.inverted ? " (note: value semantics are inverted)" : ""
      }.`,
    };
  }

  return { value: def.default, source: "default", sourceName: "" };
}

function resolveEnumFlag<T extends string>(
  def: EnumFlagDef<T>,
  env: NodeJS.ProcessEnv,
): FlagResolution<T> {
  const canonical = env[def.envName];
  if (canonical !== undefined && def.values.includes(canonical as T)) {
    return { value: canonical as T, source: "env", sourceName: def.envName };
  }
  return { value: def.default, source: "default", sourceName: "" };
}

/** Type helper: infer the resolved TypeScript type of a flag definition. */
export type FlagValue<K extends FlagName> =
  (typeof FLAG_DEFINITIONS)[K] extends BoolFlagDef
    ? boolean
    : (typeof FLAG_DEFINITIONS)[K] extends EnumFlagDef<infer V>
      ? V
      : never;

type ResolvedFlags = {
  [K in FlagName]: FlagValue<K>;
};

export interface FlagResolveResult {
  flags: ResolvedFlags;
  /** Deprecation notices to be logged by the caller. One entry per legacy alias that was read. */
  deprecations: string[];
}

/**
 * Resolve every registered flag against the provided env. Returns typed values
 * plus any deprecation notices accumulated during resolution.
 */
export function resolveAllFlags(
  env: NodeJS.ProcessEnv = process.env,
): FlagResolveResult {
  const flags = {} as ResolvedFlags;
  const deprecations: string[] = [];

  for (const [name, def] of Object.entries(FLAG_DEFINITIONS) as Array<
    [FlagName, FlagDef]
  >) {
    const resolution =
      def.kind === "bool"
        ? resolveBoolFlag(def, env)
        : resolveEnumFlag(def, env);

    // Safe: ResolvedFlags is a mapped type over FLAG_DEFINITIONS; we preserve
    // the compile-time association between `name` and `resolution.value`.
    (flags as Record<FlagName, boolean | string>)[name] = resolution.value;
    if (resolution.deprecationNotice) {
      deprecations.push(resolution.deprecationNotice);
    }
  }

  return { flags, deprecations };
}

/** Convenience: list the canonical env names for doc generation. */
export function getFlagEnvNames(): Array<{
  name: FlagName;
  envName: string;
  aliases: string[];
  defaultValue: string;
  description: string;
  category: FlagCategory;
}> {
  return (Object.entries(FLAG_DEFINITIONS) as Array<[FlagName, FlagDef]>).map(
    ([name, def]) => ({
      name,
      envName: def.envName,
      aliases: (def.aliases ?? []).map((a) => a.envName),
      defaultValue: String(def.default),
      description: def.description,
      category: def.category,
    }),
  );
}
