import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createPostHogClient } from "../PostHogClient";

describe("createPostHogClient", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is unset", async () => {
    delete process.env.POSTHOG_API_KEY;
    const client = createPostHogClient();
    expect(() =>
      client.capture({ distinctId: "u", event: "test.event" }),
    ).not.toThrow();
    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it("returns a no-op stub when POSTHOG_API_KEY is empty string", async () => {
    process.env.POSTHOG_API_KEY = "   ";
    const client = createPostHogClient();
    expect(() =>
      client.capture({ distinctId: "u", event: "test.event" }),
    ).not.toThrow();
    await expect(client.shutdown()).resolves.toBeUndefined();
  });

  it("constructs a real client when POSTHOG_API_KEY is set", () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const client = createPostHogClient();
    expect(client).toBeDefined();
    expect(typeof client.capture).toBe("function");
    expect(typeof client.shutdown).toBe("function");
  });

  it("real client.capture swallows internal errors and does not throw", () => {
    process.env.POSTHOG_API_KEY = "phc_test_key";
    const client = createPostHogClient();
    expect(() =>
      client.capture({
        distinctId: "u",
        event: "test.event",
        properties: { foo: "bar" },
      }),
    ).not.toThrow();
  });
});
