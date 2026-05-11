import { describe, it, expect, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { telemetrySourceMiddleware } from "../telemetrySource";
import {
  getRequestContext,
  runWithRequestContext,
} from "@infrastructure/requestContext";
import type { TelemetrySource } from "#shared/types/telemetry";

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function captureSource(req: Request): TelemetrySource | undefined {
  let captured: TelemetrySource | undefined;
  const res = {} as Response;
  const next: NextFunction = () => {
    captured = getRequestContext()?.source as TelemetrySource | undefined;
  };
  telemetrySourceMiddleware(req, res, next);
  return captured;
}

describe("telemetrySourceMiddleware", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("resolves 'synthetic' from header", () => {
    process.env.NODE_ENV = "production";
    expect(captureSource(mockReq({ "x-telemetry-source": "synthetic" }))).toBe(
      "synthetic",
    );
  });

  it("resolves 'user' from header", () => {
    process.env.NODE_ENV = "production";
    expect(captureSource(mockReq({ "x-telemetry-source": "user" }))).toBe(
      "user",
    );
  });

  it("resolves 'ci' from header", () => {
    process.env.NODE_ENV = "production";
    expect(captureSource(mockReq({ "x-telemetry-source": "ci" }))).toBe("ci");
  });

  it("falls through invalid header to env-based rule", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CI;
    expect(captureSource(mockReq({ "x-telemetry-source": "dogfood" }))).toBe(
      "unknown",
    );
  });

  it("resolves 'ci' from CI env when no header", () => {
    process.env.NODE_ENV = "production";
    process.env.CI = "true";
    expect(captureSource(mockReq())).toBe("ci");
  });

  it("resolves 'dev' when not production and no header/CI", () => {
    process.env.NODE_ENV = "development";
    delete process.env.CI;
    expect(captureSource(mockReq())).toBe("dev");
  });

  it("resolves 'unknown' in production fallback", () => {
    process.env.NODE_ENV = "production";
    delete process.env.CI;
    expect(captureSource(mockReq())).toBe("unknown");
  });

  it("inherits requestId from outer context when present", () => {
    process.env.NODE_ENV = "production";
    let captured: { requestId?: unknown; source?: unknown } | undefined;
    const next: NextFunction = () => {
      captured = getRequestContext();
    };
    runWithRequestContext({ requestId: "req-abc" }, () => {
      telemetrySourceMiddleware(
        mockReq({ "x-telemetry-source": "user" }),
        {} as Response,
        next,
      );
    });
    expect(captured).toEqual({ requestId: "req-abc", source: "user" });
  });
});
