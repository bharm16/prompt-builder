import type { EnhancementV2RequestContext, SlotPolicy } from "./types.js";

export class EnhancementV2PromptBuilder {
  buildPrompt(
    context: EnhancementV2RequestContext,
    policy: SlotPolicy,
  ): string {
    const lines = [
      `Generate up to ${policy.targetCount + 2} replacement phrases for a highlighted prompt span.`,
      `Category: ${policy.categoryId}`,
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
      `- Stay inside taxonomy category "${policy.categoryId}".`,
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
    const prompt = [
      this.buildPrompt(context, policy),
      "",
      "RESCUE PASS:",
      `- The previous pass produced too few compliant suggestions. Generate ${Math.max(missingCount, policy.minAcceptableCount)} additional alternatives.`,
      existingSuggestions.length > 0
        ? `- Do not repeat these prior suggestions: ${existingSuggestions.join(" | ")}`
        : "",
      "- Prioritize distinct wording and strict slot fit.",
    ];

    return prompt.filter(Boolean).join("\n");
  }
}
