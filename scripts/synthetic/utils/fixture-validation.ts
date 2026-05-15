/**
 * Pure validator for the suggestions surface's fixture format.
 *
 * The suggestions driver requires each prompt to carry one or more
 * (highlightedText, highlightedCategory) pairs that are internally
 * self-consistent — the text appears in the prompt and the category
 * is a real taxonomy ID. Without this check, an authoring mistake
 * silently feeds the engine contradictory input and the quality judge
 * correctly penalizes the resulting off-context output, which then
 * masquerades as a product quality problem (it isn't).
 *
 * See docs/superpowers/specs/2026-05-14-baseline-quality-improvement-design.md
 * § 1 for the Layer 5 false-signal context.
 */

import { isValidCategory } from "../../../shared/taxonomy.js";

import type { HarnessPrompt } from "./request-helper.js";

export function validateSuggestionsFixtures(prompts: HarnessPrompt[]): void {
  for (const prompt of prompts) {
    if (!Array.isArray(prompt.highlights) || prompt.highlights.length === 0) {
      throw new Error(
        `Fixture ${prompt.id}: must declare at least one highlight in 'highlights' array.`,
      );
    }

    for (const highlight of prompt.highlights) {
      if (!isValidCategory(highlight.category)) {
        throw new Error(
          `Fixture ${prompt.id}: invalid category '${highlight.category}'. ` +
            `Must be a valid ID per shared/taxonomy.ts (9 parent categories or namespaced attribute ID).`,
        );
      }
      if (!prompt.text.includes(highlight.text)) {
        throw new Error(
          `Fixture ${prompt.id}: highlight text '${highlight.text}' not found as substring of prompt.text. ` +
            `Hand-authored highlights must be substrings of the prompt to mirror production span-labeling output.`,
        );
      }
    }
  }
}
