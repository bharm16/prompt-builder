import { describe, expect, it } from "vitest";
import { GenerateStoryboardPreviewResponseSchema } from "../schemas/preview.schemas";

// Regression: ISSUE-37 (contract tightening)
//
// Invariant: the storyboard response schema must declare every field the
// server actually returns, including `remainingCredits`. The server stamps
// the post-billing balance into the response so the client can refresh its
// credit pill in one round-trip without a follow-up `/payment/credits/balance`
// fetch (see imageStoryboardGenerate.ts). When the schema didn't declare
// the field, it survived runtime parsing only via `.passthrough()`, but
// disappeared from the inferred TS type — every consumer had to cast
// through a hand-maintained interface that could (and did) drift from the
// runtime shape.

describe("regression: GenerateStoryboardPreviewResponseSchema declares remainingCredits (ISSUE-37)", () => {
  const validResponse = {
    success: true,
    data: {
      imageUrls: [
        "https://gcs.example/frame-1.png",
        "https://gcs.example/frame-2.png",
        "https://gcs.example/frame-3.png",
        "https://gcs.example/frame-4.png",
      ],
      storagePaths: ["users/u/storyboard/asset-1"],
      deltas: ["beat-1", "beat-2", "beat-3", "beat-4"],
      baseImageUrl: "https://gcs.example/frame-1.png",
      generationId: "gen-1",
    },
    remainingCredits: 916,
  };

  it("preserves remainingCredits on a successful storyboard response", () => {
    const parsed = GenerateStoryboardPreviewResponseSchema.parse(validResponse);
    expect(parsed.remainingCredits).toBe(916);
  });

  it("treats remainingCredits as optional — older responses without it still parse", () => {
    const { remainingCredits: _omitted, ...without } = validResponse;
    void _omitted;
    const parsed = GenerateStoryboardPreviewResponseSchema.parse(without);
    expect(parsed.success).toBe(true);
    expect(parsed.remainingCredits).toBeUndefined();
  });

  it("rejects a non-numeric remainingCredits", () => {
    const bad = {
      ...validResponse,
      remainingCredits: "916" as unknown as number,
    };
    expect(() => GenerateStoryboardPreviewResponseSchema.parse(bad)).toThrow();
  });
});
