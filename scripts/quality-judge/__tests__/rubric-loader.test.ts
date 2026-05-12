import { describe, it, expect } from "vitest";
import {
  loadRubric,
  rubricVersionFor,
  __testHashRubricContent,
} from "../rubric-loader.js";

describe("rubric-loader", () => {
  it("loads a non-empty optimize rubric", async () => {
    const text = await loadRubric("optimize");
    expect(text.length).toBeGreaterThan(0);
  });

  it("rubricVersionFor returns an 8-char hex string", async () => {
    const v = await rubricVersionFor("optimize");
    expect(v).toMatch(/^[0-9a-f]{8}$/);
  });

  it("rubricVersionFor is whitespace-stable", () => {
    expect(__testHashRubricContent("hello world\n")).toBe(
      __testHashRubricContent("  hello  world  \n"),
    );
  });

  it("same content yields the same hash", () => {
    expect(__testHashRubricContent("abc")).toBe(__testHashRubricContent("abc"));
  });
});
