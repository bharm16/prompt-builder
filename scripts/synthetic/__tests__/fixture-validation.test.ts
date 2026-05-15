import { describe, expect, it } from "vitest";

import { validateSuggestionsFixtures } from "../utils/fixture-validation.js";
import type { HarnessPrompt } from "../utils/request-helper.js";

function makePrompt(overrides: Partial<HarnessPrompt> = {}): HarnessPrompt {
  return {
    id: "test_01",
    text: "A young woman walks through a misty forest",
    tags: ["subject"],
    highlights: [{ text: "A young woman", category: "subject.identity" }],
    ...overrides,
  };
}

describe("validateSuggestionsFixtures", () => {
  it("passes on well-formed fixtures with valid taxonomy categories", () => {
    expect(() => validateSuggestionsFixtures([makePrompt()])).not.toThrow();
  });

  it("throws when a prompt has zero highlights", () => {
    const bad = makePrompt({ highlights: [] });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*at least one highlight/i,
    );
  });

  it("throws when a highlight category is not in shared/taxonomy.ts", () => {
    const bad = makePrompt({
      highlights: [{ text: "A young woman", category: "mood" }],
    });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*invalid category.*mood/i,
    );
  });

  it("throws when highlight text is not a substring of the prompt", () => {
    const bad = makePrompt({
      highlights: [{ text: "a llama", category: "subject.identity" }],
    });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(
      /test_01.*highlight text.*'a llama'.*not found/i,
    );
  });

  it("reports the prompt id in every error message for debuggability", () => {
    const bad = makePrompt({ id: "compound_07", highlights: [] });
    expect(() => validateSuggestionsFixtures([bad])).toThrow(/compound_07/);
  });

  it("validates every prompt and fails on the first bad one (loud, early)", () => {
    const good = makePrompt({ id: "good_01" });
    const bad = makePrompt({ id: "bad_02", highlights: [] });
    expect(() => validateSuggestionsFixtures([good, bad])).toThrow(/bad_02/);
  });
});
