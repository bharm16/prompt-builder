import {
  TAXONOMY,
  getParentCategory,
  type TaxonomyKey,
} from "#shared/taxonomy.ts";

import type { EnhancementV2RequestContext, SlotPolicy } from "./types.js";

/**
 * Resolve the human-readable label and description for a category id.
 * Works for parent ids (e.g. "subject") and attribute ids (e.g. "subject.appearance").
 * Returns null when the id is not in the taxonomy.
 */
function describeCategory(
  categoryId: string,
): { label: string; description: string } | null {
  const parent = getParentCategory(categoryId);
  if (!parent) return null;
  const parentKey = parent.toUpperCase() as TaxonomyKey;
  const config = TAXONOMY[parentKey];
  if (!config) return null;
  return { label: config.label, description: config.description };
}

export class EnhancementV2PromptBuilder {
  buildPrompt(
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): string {
    if (context.customRequest) {
      return this.buildCustomPrompt(context, policy);
    }

    const semantic = describeCategory(policy.categoryId);
    const categoryHeader = semantic
      ? `Category: ${policy.categoryId} — ${semantic.label}: ${semantic.description}`
      : `Category: ${policy.categoryId}`;

    const lines = [
      `Generate up to ${policy.targetCount + 2} replacement phrases for a highlighted prompt span.`,
      categoryHeader,
      `Mode: ${policy.mode}`,
      `Grammar shape: ${policy.grammar.kind}`,
      `Word range: ${policy.grammar.minWords}-${policy.grammar.maxWords}`,
      "",
      "CONTEXT:",
      `<full_prompt>${context.fullPrompt}</full_prompt>`,
      `<highlighted_text>${context.highlightedText}</highlighted_text>`,
      `<context_before>${context.contextBefore}</context_before>`,
      `<context_after>${context.contextAfter}</context_after>`,
      context.spanAnchors
        ? `<span_anchors>${context.spanAnchors}</span_anchors>`
        : "",
      context.nearbySpanHints
        ? `<nearby_hints>${context.nearbySpanHints}</nearby_hints>`
        : "",
      context.focusGuidance && context.focusGuidance.length > 0
        ? `<focus_guidance>${context.focusGuidance.join(" | ")}</focus_guidance>`
        : "",
      "",
      "RULES:",
      `- Stay inside taxonomy category "${policy.categoryId}". Each suggestion's "category" field MUST equal "${policy.categoryId}".`,
      "- Drop-in test: replacing `highlighted_text` with your suggestion inside `full_prompt` must leave a grammatical, coherent prompt. If substitution breaks the scene's meaning, the suggestion is invalid.",
      "- Scene-coherence: the suggestion must remain consistent with the rest of `full_prompt`. Do not break narrative, environment, or framing. Examples of invalid drift: suggesting outdoor lighting when full_prompt describes an indoor location; suggesting a person when full_prompt's focal entity is an object or weather phenomenon; suggesting an action when the slot is a subject.",
      `- ${policy.promptGuidance}`,
      "- Keep the replacement literal and camera-visible.",
      "- Do not return advice, headings, or explanation text in the suggestion itself.",
      "- Do not repeat the highlighted text exactly.",
      context.isVideoPrompt
        ? "- Keep the suggestion usable as a drop-in replacement for a video prompt."
        : "",
      policy.forbiddenFamilies.length > 0
        ? `- Avoid semantic drift into: ${policy.forbiddenFamilies.join(", ")}.`
        : "",
      "",
      "Return a JSON array of suggestion objects with fields:",
      "- text",
      "- category",
      "- explanation",
    ];

    return lines.filter(Boolean).join("\n");
  }

  buildRescuePrompt(
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
    existingSuggestions: string[],
    missingCount: number,
  ): string {
    const baseSection = context.customRequest
      ? this.buildCustomPrompt(context, policy)
      : this.buildPrompt(context, policy);

    const prompt = [
      baseSection,
      "",
      "RESCUE PASS:",
      `- The previous pass produced too few compliant suggestions. Generate ${Math.max(missingCount, policy.minAcceptableCount)} additional alternatives.`,
      existingSuggestions.length > 0
        ? `- Do not repeat these prior suggestions: ${existingSuggestions.join(" | ")}`
        : "",
      context.customRequest
        ? "- Prioritize distinct wording while still fulfilling the custom request."
        : "- Prioritize distinct wording and strict slot fit.",
    ];

    return prompt.filter(Boolean).join("\n");
  }

  /**
   * Custom-request prompt: the user supplied free-form steering, so we
   * surface that as the primary instruction and only use slot policy
   * details (grammar, word range) as soft guardrails. No category
   * enforcement — the user's request defines acceptability.
   */
  private buildCustomPrompt(
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): string {
    const customRequest = (context.customRequest ?? "").trim();
    const metadataBlob =
      context.customMetadata && Object.keys(context.customMetadata).length > 0
        ? JSON.stringify(context.customMetadata)
        : "";

    const lines = [
      `Generate up to ${policy.targetCount} replacement phrases for the highlighted prompt span that fulfill the user's custom request.`,
      `Word range: ${policy.grammar.minWords}-${policy.grammar.maxWords}`,
      "",
      "CONTEXT:",
      `<full_prompt>${context.fullPrompt}</full_prompt>`,
      `<highlighted_text>${context.highlightedText}</highlighted_text>`,
      `<context_before>${context.contextBefore}</context_before>`,
      `<context_after>${context.contextAfter}</context_after>`,
      `<custom_request>${customRequest}</custom_request>`,
      metadataBlob ? `<span_metadata>${metadataBlob}</span_metadata>` : "",
      "",
      "RULES:",
      "- The custom request is the primary steering signal — fulfill it literally.",
      "- The replacement must remain grammatical when substituted in place of the highlighted text.",
      "- Do not return advice, headings, or explanation text in the suggestion itself.",
      "- Do not repeat the highlighted text exactly.",
      context.isVideoPrompt
        ? "- Keep the suggestion usable as a drop-in replacement for a video prompt."
        : "",
      "",
      "Return a JSON array of suggestion objects with fields:",
      "- text",
      "- category",
      "- explanation",
    ];

    return lines.filter(Boolean).join("\n");
  }
}
