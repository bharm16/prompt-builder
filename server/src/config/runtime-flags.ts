/**
 * Runtime flags derived from the feature-flag registry.
 *
 * This module is a narrow facade over `feature-flags.ts` that preserves the
 * legacy `RuntimeFlags` shape consumed by route registrations, bootstrap code,
 * and ~12 other call sites. New code should prefer `resolveAllFlags()` from
 * `feature-flags.ts` directly.
 */

import { resolveAllFlags } from "./feature-flags.ts";

export interface RuntimeFlags {
  processRole: "api" | "worker";
  promptOutputOnly: boolean;
  enableConvergence: boolean;
  videoWorkerDisabled: boolean;
  videoJobInlineEnabled: boolean;
  videoWorkerShutdownDrainSeconds: number;
  allowUnhealthyGemini: boolean;
  unhandledRejectionMode: "classified" | "strict";
}

function resolveProcessRole(env: NodeJS.ProcessEnv): "api" | "worker" {
  const configured = env.PROCESS_ROLE;
  if (configured === "api" || configured === "worker") {
    return configured;
  }

  // Default to 'api' in all environments.
  // Workers must be explicitly started with PROCESS_ROLE=worker.
  return "api";
}

function resolvePositiveInt(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getRuntimeFlags(
  env: NodeJS.ProcessEnv = process.env,
): RuntimeFlags {
  const processRole = resolveProcessRole(env);
  const { flags } = resolveAllFlags(env);

  return {
    processRole,
    promptOutputOnly: flags.promptOutputOnly,
    enableConvergence: flags.convergence,
    videoWorkerDisabled:
      processRole !== "worker" || flags.videoJobWorkerDisabled,
    videoJobInlineEnabled: flags.videoJobInlineEnabled,
    videoWorkerShutdownDrainSeconds: resolvePositiveInt(
      env.VIDEO_WORKER_SHUTDOWN_DRAIN_SECONDS,
      45,
    ),
    allowUnhealthyGemini: flags.allowUnhealthyGemini,
    unhandledRejectionMode: flags.unhandledRejectionMode,
  };
}

/**
 * Resolve runtime flags AND surface any deprecation notices for legacy env
 * var names. Bootstrap code should call this once at startup and log the
 * notices, rather than letting them repeat on every `getRuntimeFlags` call.
 */
export function getRuntimeFlagsWithNotices(
  env: NodeJS.ProcessEnv = process.env,
): { runtime: RuntimeFlags; deprecations: string[] } {
  const { deprecations } = resolveAllFlags(env);
  return { runtime: getRuntimeFlags(env), deprecations };
}
