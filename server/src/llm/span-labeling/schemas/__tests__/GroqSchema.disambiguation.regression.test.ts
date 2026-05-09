import { describe, it, expect } from "vitest";
import { GROQ_FULL_SYSTEM_PROMPT } from "../GroqSchema";

/**
 * Regression: prompt-content invariants for the v2.3 disambiguation rules.
 *
 * The Groq system prompt encodes several explicit rules that, if silently
 * removed or weakened, will degrade label quality but pass type-checking and
 * compile cleanly. These tests pin the prompt's textual content so a
 * future edit cannot drop a rule without test breakage.
 *
 * Each rule below corresponds to a code-review finding from the v2.3
 * preparation work — keep this file in sync with the prompt revisions.
 */
describe("regression: GROQ_FULL_SYSTEM_PROMPT contains v2.3 disambiguation rules", () => {
  describe("weather rule overrides compound-noun keep-together rule", () => {
    it("declares weather as ALWAYS a separate span", () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain(
        "Weather is ALWAYS a separate span",
      );
    });

    it("explicitly states the weather rule OVERRIDES the compound-noun rule", () => {
      // Without an explicit override clause, the LLM saw two contradictory
      // rules ("weather always splits" vs '"foggy alley" → keep together')
      // and picked nondeterministically.
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(
        /weather.*OVERRIDES.*compound-noun/is,
      );
    });

    it("does not list 'foggy alley' as a Keep Together compound noun", () => {
      // Specific contradiction case found in review — must not regress.
      const keepTogetherSection =
        GROQ_FULL_SYSTEM_PROMPT.match(
          /## Keep Together[\s\S]*?(?=##|$)/,
        )?.[0] ?? "";
      expect(keepTogetherSection).not.toContain("foggy alley");
    });

    it("uses non-weather compound-noun examples (forest floor, kitchen counter)", () => {
      // Replacement examples must be free of weather words so they don't
      // re-introduce the same contradiction.
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(/forest floor|kitchen counter/);
    });
  });

  describe("dominant-descriptor rule has worked examples", () => {
    it("shows quality-wins example: warm candlelight → lighting.quality", () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(
        /warm candlelight.*lighting\.quality/s,
      );
    });

    it("shows source-wins example: light from window → lighting.source", () => {
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(
        /light from window.*lighting\.source/s,
      );
    });

    it("declares a tie-breaker preferring lighting.quality on ambiguity", () => {
      // The reviewer flagged "dominant descriptor wins" as itself ambiguous
      // without a tie-breaker. The fix added an explicit one.
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(
        /When in doubt.*prefer.*lighting\.quality/i,
      );
    });
  });

  describe("decision tree has continuous step transitions", () => {
    it("step 3 hands off explicitly to step 4 (no silent dead-end)", () => {
      // Steps 4-6 use the "→ Continue to step N" pattern; step 3 was
      // silently missing it before v2.3, leaving the LLM to infer that
      // step 3 was terminal.
      expect(GROQ_FULL_SYSTEM_PROMPT).toContain("Continue to step 4");
    });
  });

  describe("action.gesture examples are present", () => {
    it("lists multiple gesture examples (waves, points, nods, smiles, blinks)", () => {
      // If gesture examples disappear from the prompt, the model treats
      // every action as movement and the action.gesture partition collapses
      // — which is exactly what the eval's relabel attempted to encode and
      // what the reviewer flagged as a partition-coverage failure. The
      // examples live in step 3 of the decision tree (parens before the
      // arrow), not in the bare category enumeration earlier in the prompt.
      expect(GROQ_FULL_SYSTEM_PROMPT).toMatch(
        /\((?=[^)]*\b(waves|points|nods|smiles|blinks)\b)[^)]*\)\s*→\s*`?action\.gesture`?/,
      );
    });
  });
});
