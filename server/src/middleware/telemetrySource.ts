import type { Request, Response, NextFunction } from "express";
import {
  getRequestContext,
  runWithRequestContext,
} from "@infrastructure/requestContext";
import {
  TELEMETRY_SOURCE_HEADER,
  TELEMETRY_SOURCE_HEADER_ALLOWED,
  type TelemetrySource,
} from "#shared/types/telemetry";

const ALLOWED = new Set<TelemetrySource>(TELEMETRY_SOURCE_HEADER_ALLOWED);

function resolveSource(req: Request): TelemetrySource {
  const raw = req.headers[TELEMETRY_SOURCE_HEADER];
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (
    typeof candidate === "string" &&
    ALLOWED.has(candidate as TelemetrySource)
  ) {
    return candidate as TelemetrySource;
  }
  if (process.env.CI === "true") return "ci";
  return process.env.NODE_ENV === "production" ? "unknown" : "dev";
}

/**
 * Resolves a TelemetrySource for the request and stores it in the existing
 * requestContext AsyncLocalStorage frame. Mount AFTER requestIdMiddleware
 * so requestId is preserved when the new frame is created.
 */
export function telemetrySourceMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const existing = getRequestContext() ?? {};
  const source = resolveSource(req);
  runWithRequestContext({ ...existing, source }, () => next());
}
