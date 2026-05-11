/**
 * Telemetry traffic-source discriminator. Stamped on every operational
 * event so dashboards can separate real users from synthetic / dev / CI
 * traffic. See docs/superpowers/programs/measurement.md for the program
 * context.
 */
export type TelemetrySource =
  | "user" // Real authenticated or anonymous browser user
  | "synthetic" // Pre-launch harness traffic
  | "ci" // CI job exercising real endpoints
  | "dev" // NODE_ENV !== "production" fallback
  | "unknown"; // NODE_ENV === "production" fallback — bug signal

export const TELEMETRY_SOURCES: readonly TelemetrySource[] = [
  "user",
  "synthetic",
  "ci",
  "dev",
  "unknown",
] as const;

/** Header allowed to override inference. `dev` and `unknown` are inference-only. */
export const TELEMETRY_SOURCE_HEADER = "x-telemetry-source";
export const TELEMETRY_SOURCE_HEADER_ALLOWED: readonly TelemetrySource[] = [
  "user",
  "synthetic",
  "ci",
] as const;
