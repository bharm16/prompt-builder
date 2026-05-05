import { describe, expect, it } from "vitest";
import { groupShots } from "../groupShots";
import type { Generation } from "@features/generations/types";

function gen(overrides: Partial<Generation>): Generation {
  return {
    id: "g1",
    tier: "render",
    status: "completed",
    model: "sora-2",
    prompt: "neon market",
    promptVersionId: "v1",
    createdAt: 1_000,
    completedAt: 2_000,
    mediaType: "video",
    mediaUrls: ["u1"],
    isFavorite: false,
    generationSettings: null,
    ...overrides,
  } as Generation;
}

describe("groupShots", () => {
  it("groups generations by promptVersionId", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v1" }),
      gen({ id: "b", promptVersionId: "v1" }),
      gen({ id: "c", promptVersionId: "v2" }),
    ]);
    expect(shots).toHaveLength(2);
    expect(shots.find((s) => s.id === "v1")?.tiles).toHaveLength(2);
    expect(shots.find((s) => s.id === "v2")?.tiles).toHaveLength(1);
  });

  it("orders shots newest-first by max(createdAt)", () => {
    const shots = groupShots([
      gen({ id: "old", promptVersionId: "old", createdAt: 1_000 }),
      gen({ id: "new", promptVersionId: "new", createdAt: 5_000 }),
    ]);
    expect(shots[0]?.id).toBe("new");
    expect(shots[1]?.id).toBe("old");
  });

  it("falls back to a synthetic __legacy:<id> bucket for missing promptVersionId", () => {
    const shots = groupShots([
      gen({ id: "x", promptVersionId: undefined as unknown as string }),
    ]);
    expect(shots[0]?.id).toBe("__legacy:x");
    expect(shots[0]?.tiles).toHaveLength(1);
  });

  it("aggregates status: all completed → 'ready'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "completed" }),
    ]);
    expect(shots[0]?.status).toBe("ready");
  });

  it("aggregates status: any generating → 'rendering'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "generating" }),
    ]);
    expect(shots[0]?.status).toBe("rendering");
  });

  it("aggregates status: mixed completed + failed → 'mixed'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "completed" }),
      gen({ id: "b", promptVersionId: "v", status: "failed" }),
    ]);
    expect(shots[0]?.status).toBe("mixed");
  });

  it("aggregates status: all failed → 'failed'", () => {
    const shots = groupShots([
      gen({ id: "a", promptVersionId: "v", status: "failed" }),
      gen({ id: "b", promptVersionId: "v", status: "failed" }),
    ]);
    expect(shots[0]?.status).toBe("failed");
  });
});
