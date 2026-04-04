import { describe, expect, it } from "vitest";
import { getServerEnv } from "../../scripts/dev/start";

describe("regression: local api dev runs process queued video jobs", () => {
  it("enables inline video processing when the dev orchestrator starts the backend without an explicit override", () => {
    const env = getServerEnv({ PATH: "/usr/bin" } as NodeJS.ProcessEnv);

    expect(env.VIDEO_JOB_INLINE_ENABLED).toBe("true");
  });

  it("preserves an explicit inline-processing override", () => {
    const env = getServerEnv({
      PATH: "/usr/bin",
      VIDEO_JOB_INLINE_ENABLED: "false",
    } as NodeJS.ProcessEnv);

    expect(env.VIDEO_JOB_INLINE_ENABLED).toBe("false");
  });
});
