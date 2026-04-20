import { describe, expect, it } from "vitest";
import { resolveAllFlags, getFlagEnvNames } from "../feature-flags";

describe("resolveAllFlags", () => {
  it("returns all declared flags at their defaults when env is empty", () => {
    const { flags, deprecations } = resolveAllFlags({} as NodeJS.ProcessEnv);
    expect(flags.promptOutputOnly).toBe(false);
    expect(flags.convergence).toBe(true);
    expect(flags.webhookReconciliationEnabled).toBe(true);
    // VIDEO_ASSET_RECONCILER_DISABLED !== "false" was disabled-by-default
    // historically; canonical form preserves that via default: false.
    expect(flags.videoAssetReconcilerEnabled).toBe(false);
    expect(flags.unhandledRejectionMode).toBe("classified");
    expect(deprecations).toEqual([]);
  });

  it("honors the canonical env name without emitting a deprecation", () => {
    const { flags, deprecations } = resolveAllFlags({
      WEBHOOK_RECONCILIATION_ENABLED: "false",
    } as NodeJS.ProcessEnv);
    expect(flags.webhookReconciliationEnabled).toBe(false);
    expect(deprecations).toEqual([]);
  });

  it("translates legacy *_DISABLED aliases with correct inversion", () => {
    const { flags, deprecations } = resolveAllFlags({
      BILLING_PROFILE_REPAIR_DISABLED: "true",
    } as NodeJS.ProcessEnv);
    expect(flags.billingProfileRepairEnabled).toBe(false);
    expect(deprecations).toHaveLength(1);
    expect(deprecations[0]).toContain("BILLING_PROFILE_REPAIR_DISABLED");
    expect(deprecations[0]).toContain("BILLING_PROFILE_REPAIR_ENABLED");
  });

  it("prefers canonical env var over alias when both are set", () => {
    const { flags, deprecations } = resolveAllFlags({
      WEBHOOK_RECONCILIATION_ENABLED: "false",
      WEBHOOK_RECONCILIATION_DISABLED: "false",
    } as NodeJS.ProcessEnv);
    expect(flags.webhookReconciliationEnabled).toBe(false);
    expect(deprecations).toEqual([]);
  });

  it("treats GEMINI_ALLOW_UNHEALTHY as a non-inverted alias", () => {
    const { flags, deprecations } = resolveAllFlags({
      GEMINI_ALLOW_UNHEALTHY: "true",
    } as NodeJS.ProcessEnv);
    expect(flags.allowUnhealthyGemini).toBe(true);
    expect(deprecations).toHaveLength(1);
    expect(deprecations[0]).toContain("GEMINI_ALLOW_UNHEALTHY");
  });

  it("preserves historical OR-semantics for allowUnhealthyGemini when both names are set", () => {
    // Old behavior: isTrue(ALLOW_UNHEALTHY_GEMINI) || isTrue(GEMINI_ALLOW_UNHEALTHY)
    // Either set to "true" enables the flag, regardless of the other.
    const { flags: aliasWins } = resolveAllFlags({
      ALLOW_UNHEALTHY_GEMINI: "false",
      GEMINI_ALLOW_UNHEALTHY: "true",
    } as NodeJS.ProcessEnv);
    expect(aliasWins.allowUnhealthyGemini).toBe(true);

    const { flags: canonicalWins } = resolveAllFlags({
      ALLOW_UNHEALTHY_GEMINI: "true",
      GEMINI_ALLOW_UNHEALTHY: "false",
    } as NodeJS.ProcessEnv);
    expect(canonicalWins.allowUnhealthyGemini).toBe(true);

    const { flags: bothFalse } = resolveAllFlags({
      ALLOW_UNHEALTHY_GEMINI: "false",
      GEMINI_ALLOW_UNHEALTHY: "false",
    } as NodeJS.ProcessEnv);
    expect(bothFalse.allowUnhealthyGemini).toBe(false);
  });

  it("validates enum values against the declared set", () => {
    const { flags: strict } = resolveAllFlags({
      UNHANDLED_REJECTION_MODE: "strict",
    } as NodeJS.ProcessEnv);
    expect(strict.unhandledRejectionMode).toBe("strict");

    const { flags: bogus } = resolveAllFlags({
      UNHANDLED_REJECTION_MODE: "nonsense",
    } as NodeJS.ProcessEnv);
    expect(bogus.unhandledRejectionMode).toBe("classified");
  });

  it("ignores non-boolean values and falls back to default", () => {
    const { flags } = resolveAllFlags({
      PROMPT_OUTPUT_ONLY: "yes",
    } as NodeJS.ProcessEnv);
    expect(flags.promptOutputOnly).toBe(false);
  });
});

describe("getFlagEnvNames", () => {
  it("surfaces canonical and alias names for every registered flag", () => {
    const entries = getFlagEnvNames();
    const webhook = entries.find(
      (e) => e.name === "webhookReconciliationEnabled",
    );
    expect(webhook).toBeDefined();
    expect(webhook?.envName).toBe("WEBHOOK_RECONCILIATION_ENABLED");
    expect(webhook?.aliases).toContain("WEBHOOK_RECONCILIATION_DISABLED");
  });

  it("categorizes flags so the doc generator can group them", () => {
    const entries = getFlagEnvNames();
    const categories = new Set(entries.map((e) => e.category));
    expect(categories).toContain("mode");
    expect(categories).toContain("killswitch");
  });
});
