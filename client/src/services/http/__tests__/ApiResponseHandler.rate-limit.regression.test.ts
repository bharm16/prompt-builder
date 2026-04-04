import { describe, expect, it } from "vitest";

import { ApiErrorFactory } from "../ApiErrorFactory";
import { ApiResponseHandler } from "../ApiResponseHandler";

describe("regression: rate-limited responses keep the HTTP 429 signal", () => {
  it("preserves status and rate-limit code when a 429 body is plain text", async () => {
    const handler = new ApiResponseHandler(new ApiErrorFactory());
    const response = new Response("Too many requests from this IP", {
      status: 429,
      statusText: "Too Many Requests",
      headers: { "content-type": "text/plain" },
    });

    await expect(handler.handle(response)).rejects.toMatchObject({
      message: "Too Many Requests",
      status: 429,
      code: "RATE_LIMITED",
    });
  });
});
