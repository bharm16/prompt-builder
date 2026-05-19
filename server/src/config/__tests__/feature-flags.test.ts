import { describe, expect, it } from "vitest";
import { resolveAllFlags, getFlagEnvNames } from "../feature-flags";

describe("resolveAllFlags", () => {
  it("returns all declared flags at their defaults when env is empty", () => {
    const { flags, deprecations } = resolveAllFlags({} as NodeJS.ProcessEnv);
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
      ENABLE_CONVERGENCE: "yes",
    } as NodeJS.ProcessEnv);
    expect(flags.convergence).toBe(true);
  });
});

describe("getFlagEnvNames", () => {
  it("surfaces canonical env name for every registered flag", () => {
    const entries = getFlagEnvNames();
    const webhook = entries.find(
      (e) => e.name === "webhookReconciliationEnabled",
    );
    expect(webhook).toBeDefined();
    expect(webhook?.envName).toBe("WEBHOOK_RECONCILIATION_ENABLED");
    expect(webhook?.aliases).toEqual([]);
  });

  it("categorizes flags so the doc generator can group them", () => {
    const entries = getFlagEnvNames();
    const categories = new Set(entries.map((e) => e.category));
    expect(categories).toContain("mode");
    expect(categories).toContain("killswitch");
  });
});

describe("feature-flags requiresEnv", () => {
  it("face embedding flag declares Replicate token dependency", () => {
    const flags = getFlagEnvNames();
    const faceEmbedding = flags.find(
      (f) => f.envName === "ENABLE_FACE_EMBEDDING",
    );
    expect(faceEmbedding?.requiresEnv).toEqual(["REPLICATE_API_TOKEN"]);
  });

  it("clip flag declares Replicate token dependency", () => {
    const flags = getFlagEnvNames();
    const clip = flags.find((f) => f.envName === "CONTINUITY_CLIP_ENABLED");
    expect(clip?.requiresEnv).toEqual(["REPLICATE_API_TOKEN"]);
  });

  it("face embedding flag declares convergence dependency", () => {
    const flags = getFlagEnvNames();
    const faceEmbedding = flags.find(
      (f) => f.envName === "ENABLE_FACE_EMBEDDING",
    );
    expect(faceEmbedding?.dependsOn).toEqual(["ENABLE_CONVERGENCE"]);
  });

  it("clip flag declares convergence dependency", () => {
    const flags = getFlagEnvNames();
    const clip = flags.find((f) => f.envName === "CONTINUITY_CLIP_ENABLED");
    expect(clip?.dependsOn).toEqual(["ENABLE_CONVERGENCE"]);
  });
});
