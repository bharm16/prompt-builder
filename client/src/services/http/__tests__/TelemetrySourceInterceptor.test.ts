import { describe, it, expect, beforeEach } from "vitest";
import { applyTelemetrySourceHeader } from "../TelemetrySourceInterceptor";

describe("applyTelemetrySourceHeader", () => {
  beforeEach(() => {
    // No env mutation needed — mode is injected directly for deterministic tests.
  });

  it("sets X-Telemetry-Source: user in production builds", () => {
    const built = applyTelemetrySourceHeader(
      {
        url: "/api/optimize",
        init: { headers: { "Content-Type": "application/json" } },
      },
      "production",
    );
    expect(built.init.headers).toMatchObject({
      "X-Telemetry-Source": "user",
      "Content-Type": "application/json",
    });
  });

  it("omits the header in non-production builds", () => {
    const built = applyTelemetrySourceHeader(
      {
        url: "/api/optimize",
        init: { headers: { "Content-Type": "application/json" } },
      },
      "development",
    );
    expect(built.init.headers).not.toHaveProperty("X-Telemetry-Source");
  });

  it("preserves existing headers", () => {
    const built = applyTelemetrySourceHeader(
      {
        url: "/api/optimize",
        init: { headers: { Authorization: "Bearer xyz" } },
      },
      "production",
    );
    expect(built.init.headers).toEqual({
      Authorization: "Bearer xyz",
      "X-Telemetry-Source": "user",
    });
  });
});
