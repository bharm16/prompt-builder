import { logger } from "@infrastructure/Logger";
import { extractSemanticSpans } from "@llm/span-labeling/nlp/NlpSpanService";
import { getParentCategory } from "@shared/taxonomy";
import {
  VISUAL_EXAMPLES,
  TECHNICAL_EXAMPLES,
  NARRATIVE_EXAMPLES,
} from "../config/EnhancementExamples";
import { PROMPT_PREVIEW_LIMIT } from "../constants";
import { getCategoryGuidance } from "./categoryGuidance";
import {
  getSecurityPrefix,
  getFormatInstruction,
  detectAndGetCapabilities,
  wrapUserData,
} from "@utils/provider/index";
import type {
  PromptBuildParams,
  CustomPromptParams,
  SharedPromptContext,
  BrainstormContext,
} from "./types";

/**
 * CleanPromptBuilder - Provider-Aware Implementation
 *
 * BALANCE: Keep prompts focused but INCLUDE ESSENTIAL CONTEXT.
 *
 * Provider-Aware Optimizations:
 * - OpenAI: Skip security prefix (goes in developerMessage instead)
 * - OpenAI with strict schema: Skip format instructions (grammar handles it)
 * - Groq/Llama: Include security and format instructions in prompt
 *
 * Key learnings:
 * - Llama 8B needs simpler instructions (fewer rules, less verbosity)
 * - BUT it still needs the actual context to generate relevant suggestions
 * - Few-shot examples help with FORMAT but can mislead on CONTENT
 * - The full prompt preview is ESSENTIAL for contextually appropriate suggestions
 *
 * Implements PDF designs:
 * - Design 1: Orthogonal Attribute Injector (technical slots)
 * - Design 2: Visual Decomposition Expander (descriptors/style/appearance)
 * - Design 3: Grammar-Constrained Narrative Editor (actions/verbs)
 */
export class CleanPromptBuilder {
  private readonly log = logger.child({ service: "CleanPromptBuilder" });
  private static readonly BODY_PART_TERMS =
    /\b(hands?|fingers?|face|arms?|legs?|feet|foot|eyes?|hair|lips?|skin|cheeks?|brow|forehead|chin|palms?|knuckles?|nails?)\b/i;

  buildPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({
      ...params,
      mode: params?.isPlaceholder ? "placeholder" : "rewrite",
    });
  }

  buildRewritePrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: "rewrite" });
  }

  buildPlaceholderPrompt(params: PromptBuildParams = {}): string {
    return this._buildSpanPrompt({ ...params, mode: "placeholder" });
  }

  buildCustomPrompt({
    highlightedText,
    customRequest,
    fullPrompt,
    isVideoPrompt,
    contextBefore,
    contextAfter,
    metadata,
  }: CustomPromptParams): string {
    const startTime = performance.now();
    const operation = "buildCustomPrompt";

    this.log.debug("Building custom prompt", {
      operation,
      isVideoPrompt,
      highlightLength: highlightedText.length,
      fullPromptLength: fullPrompt.length,
    });

    const promptPreview = this._trim(fullPrompt, PROMPT_PREVIEW_LIMIT);
    const { capabilities } = detectAndGetCapabilities({
      operation: "custom_suggestions",
    });
    const useWrapper = !capabilities.strictJsonSchema;

    // Get provider-aware security prefix
    const securityPrefix = getSecurityPrefix({
      operation: "custom_suggestions",
    });

    // Use XML wrapper for user data
    const trimmedContextBefore = contextBefore
      ? this._trim(contextBefore, 500, true)
      : "";
    const trimmedContextAfter = contextAfter
      ? this._trim(contextAfter, 500)
      : "";
    const metadataBlob =
      metadata && Object.keys(metadata).length > 0
        ? this._trim(JSON.stringify(metadata), 2000)
        : "";

    const userDataSection = wrapUserData({
      full_context: promptPreview,
      highlighted_text: highlightedText,
      custom_request: customRequest,
      context_before: trimmedContextBefore,
      context_after: trimmedContextAfter,
      span_metadata: metadataBlob,
    });

    // Get format instruction (provider-aware)
    const formatInstruction = getFormatInstruction({
      operation: "custom_suggestions",
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? "{" : "[",
    });

    const outputLine = useWrapper
      ? 'Output JSON object: {"suggestions": [{"text":"replacement","category":"custom","explanation":"why this fits"}]}'
      : 'Output JSON array: [{"text":"replacement","category":"custom","explanation":"why this fits"}]';

    const result = [
      securityPrefix,
      "Generate up to 12 replacement phrases for the highlighted text.",
      "",
      userDataSection,
      "",
      "RULES:",
      "1. Replacements must fit the context of the full prompt",
      "2. Use local context and span metadata when provided",
      "3. Keep the same subject/topic - just vary the description",
      "4. Return ONLY the replacement phrase (2-50 words)",
      "",
      outputLine,
      formatInstruction,
    ]
      .filter(Boolean)
      .join("\n");

    const duration = Math.round(performance.now() - startTime);
    const promptLength = result.length;

    this.log.info("Custom prompt built", {
      operation,
      duration,
      promptLength,
    });

    return result;
  }

  /**
   * Core builder
   */
  private _buildSpanPrompt(params: PromptBuildParams): string {
    const startTime = performance.now();
    const operation = "_buildSpanPrompt";

    const {
      highlightedText = "",
      contextBefore = "",
      contextAfter = "",
      fullPrompt = "",
      brainstormContext = null,
      editHistory = [],
      modelTarget = null,
      isVideoPrompt = false,
      phraseRole = null,
      highlightedCategory = null,
      promptSection = null,
      videoConstraints = null,
      highlightWordCount = null,
      spanAnchors = "",
      nearbySpanHints = "",
      focusGuidance = [],
      mode = "rewrite",
    } = params;

    this.log.debug("Building span prompt", {
      operation,
      mode,
      isVideoPrompt,
      hasBrainstormContext: !!brainstormContext,
      highlightLength: highlightedText.length,
    });

    const slot = this._resolveSlot({
      highlightedText,
      phraseRole,
      highlightedCategory,
      contextBefore,
      contextAfter,
    });
    const design = this._pickDesign(slot, isVideoPrompt, mode);

    this.log.debug("Resolved slot and design", {
      operation,
      slot,
      design,
    });

    const ctx = this._buildContext({
      highlightedText,
      highlightedCategory,
      contextBefore,
      contextAfter,
      fullPrompt,
      brainstormContext,
      editHistory,
      modelTarget,
      promptSection,
      videoConstraints,
      highlightWordCount,
      spanAnchors,
      nearbySpanHints,
      focusGuidance,
      slot,
      mode,
    });

    const { provider, capabilities } = detectAndGetCapabilities({
      operation: "enhance_suggestions",
    });
    const useWrapper = !capabilities.strictJsonSchema;

    // Select prompt based on design
    let result: string;
    if (design === "orthogonal") {
      result = this._buildTechnicalPrompt(ctx, provider, useWrapper);
    } else if (design === "narrative") {
      result = this._buildActionPrompt(ctx, provider, useWrapper);
    } else {
      result = this._buildVisualPrompt(ctx, provider, useWrapper);
    }

    const duration = Math.round(performance.now() - startTime);

    this.log.info("Span prompt built", {
      operation,
      duration,
      design,
      slot,
      promptLength: result.length,
    });

    return result;
  }

  /**
   * Design 1: Technical/Camera/Lighting slots
   *
   * Provider-aware: Security prefix only added for non-OpenAI providers
   * OpenAI uses developerMessage for security (passed separately)
   */
  private _buildTechnicalPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean,
  ): string {
    // Get provider-aware security prefix
    const securityPrefix = getSecurityPrefix({
      operation: "enhance_suggestions",
    });

    // Use XML wrapper for user data
    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    // Get format instruction (provider-aware - may be empty for OpenAI with schema)
    const formatInstruction = getFormatInstruction({
      operation: "enhance_suggestions",
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? "{" : "[",
    });

    const exampleBlock = this._buildExampleBlock(
      TECHNICAL_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper,
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? "CONTEXT: Respect span anchors; avoid conflicting nearby spans."
        : "";
    const guidanceText = this._resolveGuidanceText(ctx);
    const focusGuidanceText = this._resolveFocusGuidanceText(ctx);
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"visual effect"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"visual effect"}]`;

    return [
      securityPrefix,
      "Generate up to 12 alternative TECHNICAL phrases for video prompts.",
      "",
      userDataSection,
      "",
      "RULES:",
      "1. Keep the same SUBJECT - only change the technical/camera approach",
      "2. Use cinematography terms (angles, lenses, movements, lighting)",
      "3. Each option should create a different visual effect",
      "4. Return ONLY the replacement phrase (2-50 words)",
      "DIVERSITY: Vary angle, lens, movement, or lighting (not just synonyms).",
      guidanceText ? `GUIDANCE: ${guidanceText}` : "",
      focusGuidanceText ? `FOCUS: ${focusGuidanceText}` : "",
      spanRule,
      "",
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : "",
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : "",
      "",
      outputLine,
      exampleBlock,
      formatInstruction,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Design 2: Visual/Style/Subject slots
   *
   * Provider-aware: Uses XML wrapper for user data
   */
  private _buildVisualPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean,
  ): string {
    const securityPrefix = getSecurityPrefix({
      operation: "enhance_suggestions",
    });

    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    const formatInstruction = getFormatInstruction({
      operation: "enhance_suggestions",
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? "{" : "[",
    });

    const exampleBlock = this._buildExampleBlock(
      VISUAL_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper,
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? "CONTEXT: Respect span anchors; avoid conflicting nearby spans."
        : "";
    const guidanceText = this._resolveGuidanceText(ctx);
    const focusGuidanceText = this._resolveFocusGuidanceText(ctx);
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"what viewer sees differently"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"what viewer sees differently"}]`;

    return [
      securityPrefix,
      "Generate up to 12 alternative VISUAL DESCRIPTIONS for the highlighted phrase.",
      "",
      userDataSection,
      "",
      "RULES:",
      "1. Fill the SAME ROLE in the scene - but with VISUALLY DISTINCT alternatives",
      "2. Suggestions should produce noticeably DIFFERENT video frames",
      '3. Avoid synonyms - "silky chestnut" vs "fluffy brown" renders nearly identical',
      "4. Think: what OTHER thing could fill this role?",
      "5. Return ONLY the replacement phrase (2-50 words)",
      "DIVERSITY: Prefer role-level changes that alter the visual outcome, not minor adjective swaps.",
      guidanceText ? `GUIDANCE: ${guidanceText}` : "",
      focusGuidanceText ? `FOCUS: ${focusGuidanceText}` : "",
      spanRule,
      "",
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : "",
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : "",
      "",
      outputLine,
      exampleBlock,
      formatInstruction,
    ]
      .filter(Boolean)
      .join("\n");
  }

  /**
   * Design 3: Action/Verb slots
   */
  private _buildActionPrompt(
    ctx: SharedPromptContext,
    provider: string,
    useWrapper: boolean,
  ): string {
    const securityPrefix = getSecurityPrefix({
      operation: "enhance_suggestions",
    });

    const userDataSection = wrapUserData({
      full_context: ctx.promptPreview,
      highlighted_text: ctx.highlightedText,
      surrounding_context: ctx.inlineContext,
      ...(ctx.spanAnchors ? { span_anchors: ctx.spanAnchors } : {}),
      ...(ctx.nearbySpanHints ? { nearby_spans: ctx.nearbySpanHints } : {}),
    });

    const formatInstruction = getFormatInstruction({
      operation: "enhance_suggestions",
      isArray: !useWrapper,
      hasSchema: true,
      targetStart: useWrapper ? "{" : "[",
    });

    const exampleBlock = this._buildExampleBlock(
      NARRATIVE_EXAMPLES,
      ctx.slotLabel,
      provider,
      useWrapper,
    );
    const spanRule =
      ctx.spanAnchors || ctx.nearbySpanHints
        ? "CONTEXT: Respect span anchors; avoid conflicting nearby spans."
        : "";
    const guidanceText = this._resolveGuidanceText(ctx);
    const focusGuidanceText = this._resolveFocusGuidanceText(ctx);
    const outputLine = useWrapper
      ? `Output JSON object: {"suggestions": [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"how motion changes"}]}`
      : `Output JSON array: [{"text":"phrase","category":"${ctx.slotLabel}","explanation":"how motion changes"}]`;

    return [
      securityPrefix,
      "Generate up to 12 alternative ACTION phrases for video prompts.",
      "",
      userDataSection,
      "",
      "RULES:",
      "1. Keep the same SUBJECT doing the action - only change the action itself",
      '2. One continuous action only (no sequences like "walks then runs")',
      "3. Actions must be camera-visible physical behavior",
      "4. Return ONLY the replacement phrase (2-50 words)",
      "5. Return ONLY the action verb/phrase. Do NOT repeat the object that follows the highlighted text in the surrounding context.",
      "DIVERSITY: Vary the physical behavior or staging, not just intensity.",
      guidanceText ? `GUIDANCE: ${guidanceText}` : "",
      focusGuidanceText ? `FOCUS: ${focusGuidanceText}` : "",
      spanRule,
      "",
      ctx.constraintLine ? `CONSTRAINTS: ${ctx.constraintLine}` : "",
      ctx.constraintNotes ? `REQUIREMENTS: ${ctx.constraintNotes}` : "",
      "",
      outputLine,
      exampleBlock,
      formatInstruction,
    ]
      .filter(Boolean)
      .join("\n");
  }

  private _buildExampleBlock(
    examples: Array<{ text: string; explanation: string }>,
    slotLabel: string,
    provider: string,
    useWrapper: boolean,
  ): string {
    if (!this._shouldIncludeExamples(provider)) return "";
    const escapeValue = (value: string): string =>
      value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const sample = examples.slice(0, 2);
    const lines = [
      "EXAMPLE OUTPUT (format only; do not copy content):",
      ...(useWrapper ? ["{", '  "suggestions": ['] : ["["]),
      ...sample.map((example, index) => {
        const suffix = index < sample.length - 1 ? "," : "";
        return `  {"text":"${escapeValue(example.text)}","category":"${slotLabel}","explanation":"${escapeValue(example.explanation)}"}${suffix}`;
      }),
      ...(useWrapper ? ["  ]", "}"] : ["]"]),
    ];
    return lines.join("\n");
  }

  private _shouldIncludeExamples(provider: string): boolean {
    return provider === "groq" || provider === "qwen";
  }

  /**
   * Build context object
   */
  private _buildContext({
    highlightedText,
    highlightedCategory,
    contextBefore,
    contextAfter,
    fullPrompt,
    brainstormContext,
    editHistory,
    modelTarget,
    promptSection,
    videoConstraints,
    highlightWordCount,
    spanAnchors,
    nearbySpanHints,
    focusGuidance,
    slot,
    mode,
  }: {
    highlightedText: string;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
    fullPrompt: string;
    brainstormContext: BrainstormContext | null;
    editHistory: Array<{ original?: string }>;
    modelTarget: string | null;
    promptSection: string | null;
    videoConstraints: {
      mode?: string;
      minWords?: number;
      maxWords?: number;
      maxSentences?: number;
      disallowTerminalPunctuation?: boolean;
      formRequirement?: string;
      focusGuidance?: string[];
      extraRequirements?: string[];
    } | null;
    highlightWordCount: number | null;
    spanAnchors?: string;
    nearbySpanHints?: string;
    focusGuidance?: string[];
    slot: string;
    mode: "rewrite" | "placeholder";
  }): SharedPromptContext {
    // LONGER context windows - context is critical for relevance
    const prefix = this._trim(contextBefore, 150, true);
    const suffix = this._trim(contextAfter, 150);
    const inlineContext = `${prefix}[${highlightedText}]${suffix}`;

    // Longer prompt preview - the model needs to understand the full scene
    const promptPreview = this._trim(fullPrompt, PROMPT_PREVIEW_LIMIT);

    // Build constraint line
    let constraintLine = "";
    const constraintNotes: string[] = [];
    if (videoConstraints) {
      const parts: string[] = [];
      if (videoConstraints.minWords || videoConstraints.maxWords) {
        parts.push(
          `${videoConstraints.minWords || 2}-${videoConstraints.maxWords || 50} words`,
        );
      }
      if (videoConstraints.mode === "micro") {
        parts.push("noun phrases only");
      } else if (videoConstraints.mode === "adjective") {
        parts.push("adjective or participial phrases only");
      } else if (videoConstraints.mode === "verb") {
        parts.push("verb phrases only");
      }
      constraintLine = parts.join(", ");

      if (videoConstraints.formRequirement) {
        constraintNotes.push(videoConstraints.formRequirement);
      }
      if (Array.isArray(videoConstraints.extraRequirements)) {
        constraintNotes.push(...videoConstraints.extraRequirements);
      }
    }

    // Add word count hint
    if (Number.isFinite(highlightWordCount) && highlightWordCount) {
      constraintLine = constraintLine
        ? `${constraintLine}; aim for ~${highlightWordCount} words`
        : `aim for ~${highlightWordCount} words`;
    }

    const focusGuidanceCombined = [
      ...(videoConstraints?.focusGuidance || []),
      ...(focusGuidance || []),
    ].filter(Boolean);

    const sharedContext: SharedPromptContext = {
      highlightedText,
      highlightedCategory,
      inlineContext,
      prefix,
      suffix,
      promptPreview,
      constraintLine,
      constraintNotes: constraintNotes.length
        ? constraintNotes.join(" | ")
        : "",
      modelLine: modelTarget ? `Target: ${modelTarget}` : "",
      sectionLine: promptSection ? `Section: ${promptSection}` : "",
      slotLabel: slot || "subject",
      guidance: getCategoryGuidance(highlightedCategory),
      ...(focusGuidanceCombined.length
        ? { focusGuidance: focusGuidanceCombined.join(" | ") }
        : {}),
      mode,
      replacementInstruction: "",
    };
    if (spanAnchors !== undefined) {
      sharedContext.spanAnchors = spanAnchors;
    }
    if (nearbySpanHints !== undefined) {
      sharedContext.nearbySpanHints = nearbySpanHints;
    }
    if (highlightWordCount !== undefined) {
      sharedContext.highlightWordCount = highlightWordCount;
    }
    return sharedContext;
  }

  /**
   * Resolve slot using taxonomy
   */
  private _resolveSlot({
    highlightedText,
    phraseRole,
    highlightedCategory,
  }: {
    highlightedText: string;
    phraseRole: string | null;
    highlightedCategory: string | null;
    contextBefore: string;
    contextAfter: string;
  }): string {
    if (highlightedCategory) {
      const parent = getParentCategory(highlightedCategory);
      if (parent) return parent;
    }

    if (phraseRole) {
      const parent = getParentCategory(phraseRole);
      if (parent) return parent;
    }

    if (highlightedText) {
      const result = extractSemanticSpans(highlightedText) as unknown as {
        spans: Array<{ role: string; confidence: number }>;
      };
      const spans = "spans" in result ? result.spans : [];
      if (spans.length > 0) {
        const bestSpan = spans.reduce((a, b) =>
          a.confidence > b.confidence ? a : b,
        );
        const parent = getParentCategory(bestSpan.role);
        if (parent) return parent;
      }
    }

    return "subject";
  }

  private _pickDesign(
    slot: string,
    isVideoPrompt: boolean,
    mode: "rewrite" | "placeholder",
  ): "orthogonal" | "narrative" | "visual" {
    if (mode === "placeholder") {
      return slot === "action" ? "narrative" : "visual";
    }
    if (slot === "action") return "narrative";
    if (
      slot === "camera" ||
      slot === "shot" ||
      slot === "lighting" ||
      slot === "technical"
    ) {
      return "orthogonal";
    }
    return "visual";
  }

  private _resolveGuidanceText(ctx: SharedPromptContext): string {
    const category = this._normalizeCategoryKey(ctx.highlightedCategory || "");
    if (this._isShotTypeCategory(category)) {
      return "This describes shot framing. Suggest DIFFERENT shot sizes or framing alternatives (ECU, CU, MCU, MS, MWS, WS, EWS, OTS, bird's-eye, worm's-eye). Do NOT keep the same shot size and add modifiers.";
    }

    if (category === "camera.angle") {
      return "This describes camera angle. Suggest alternative viewpoints only (eye-level, low-angle, high-angle, overhead, Dutch tilt). Do NOT add movement, lens, focus, or shot-size details.";
    }

    if (category === "camera.movement") {
      return "This describes camera movement. Suggest a single camera move or support style only (dolly, pan, tilt, crane, handheld, static). Do NOT add lens, framing, or focus details.";
    }

    if (category === "camera.focus") {
      return "This describes focus treatment. Suggest focus, blur, bokeh, or depth-of-field alternatives only. Do NOT add angle, movement, lens, or shot-size details.";
    }

    if (category === "camera.lens") {
      return "This describes lens choice. Suggest focal length, lens family, or aperture alternatives only. Do NOT add movement, framing, focus pulls, or lighting details.";
    }

    if (category === "lighting.quality") {
      return "This describes light quality. Suggest different qualities (soft, hard, diffused, low-key, hazy) without changing the light source, time of day, or camera setup.";
    }

    if (category === "lighting.timeofday") {
      return "This describes time of day. Suggest a different time period or daylight condition only (dawn, noon, dusk, twilight, night). Do NOT describe light direction, flare, or camera effects.";
    }

    if (category === "environment.location") {
      return "This describes the outside location. Suggest a different external setting with atmosphere or time-of-day detail. Do NOT replace it with an interior prop or surface.";
    }

    if (category === "environment.context") {
      return "This describes in-scene environmental context. Suggest surfaces, atmosphere, or spatial context already in the scene. Do NOT swap to a new external location.";
    }

    if (category === "style.aesthetic") {
      return "This describes visual treatment. Suggest different aesthetic looks, color grades, or post-processing styles only. Do NOT introduce camera movement, shot types, or lighting direction.";
    }

    if (this._isBodyPartAppearanceCategory(category, ctx.highlightedText)) {
      return "This describes a body part. Suggest DIFFERENT body parts or fundamentally different physical states of the same body part that read clearly on camera.";
    }

    return ctx.guidance;
  }

  private _resolveFocusGuidanceText(ctx: SharedPromptContext): string {
    const category = this._normalizeCategoryKey(ctx.highlightedCategory || "");
    const focusItems = (ctx.focusGuidance || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

    if (this._isShotTypeCategory(category)) {
      const filtered = focusItems.filter(
        (item) => !/\b(wardrobe|era|material)\b/i.test(item),
      );
      return [
        "Suggest a DIFFERENT shot size or framing, not the current shot type with added lens or movement details.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "camera.angle") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(lens|focal|mm|dolly|track|tracking|pan|tilt|crane|zoom|handheld|static|framing|shot|focus|bokeh|lighting)\b/i,
      );
      return [
        "Suggest only angle or viewpoint changes.",
        "Do not include movement, lens, framing, focus, or lighting details.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "camera.movement") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(lens|focal|mm|framing|shot|focus|bokeh|depth of field|lighting)\b/i,
      );
      return [
        "Use a camera move or support-style phrase only.",
        "Do not add lens, focus, or framing details.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "camera.focus") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(lens|focal|mm|dolly|track|tracking|pan|tilt|crane|zoom|handheld|static|framing|shot|lighting)\b/i,
      );
      return [
        "Keep the replacement focused on blur, bokeh, rack focus, or depth of field.",
        "Do not introduce movement, lens choice, or shot-size changes.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "camera.lens") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(dolly|track|tracking|pan|tilt|crane|zoom|handheld|static|framing|shot|focus|bokeh|lighting)\b/i,
      );
      return [
        "Keep the replacement to focal length, lens family, or aperture language only.",
        "Do not introduce movement, framing, or focus-pull instructions.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "lighting.quality") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(window|backlight|side[-\s]?light|rim light|key light|from the|left|right|lens|camera|shot|framing)\b/i,
      );
      return [
        "Focus on light softness, contrast, diffusion, or warmth.",
        "Do not turn the slot into a source-direction clause.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "lighting.timeofday") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(window|backlight|side[-\s]?light|rim light|key light|from the|left|right|lens|camera|shot|framing|flare|halation)\b/i,
      );
      return [
        "Suggest only a different time period or daylight condition.",
        "Do not turn the slot into a lighting-direction or post-processing phrase.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "environment.location") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(window|dashboard|glass|seat|interior|surface|camera|lens|shot)\b/i,
      );
      return [
        "Anchor the replacement in an external place with atmosphere.",
        "Avoid interior objects or camera-language leakage.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "environment.context") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(forest|beach|street|park|city|meadow|shore|sunset|sunrise|golden hour|camera|lens|shot)\b/i,
      );
      return [
        "Keep the replacement inside the current scene as an object, surface, or atmospheric context beat.",
        "Do not swap to a new destination or outside landscape.",
        ...filtered,
      ].join(" | ");
    }

    if (category === "style.aesthetic") {
      const filtered = this._filterFocusItems(
        focusItems,
        /\b(dolly|track|tracking|pan|tilt|crane|zoom|handheld|static|lens|mm|shot|framing|left|right|window|backlight|side[-\s]?light)\b/i,
      );
      return [
        "Keep the output scoped to visual treatment, color, medium, or post-processing.",
        "Do not leak into camera setup or lighting direction.",
        ...filtered,
      ].join(" | ");
    }

    if (this._isBodyPartAppearanceCategory(category, ctx.highlightedText)) {
      const filtered = focusItems.filter(
        (item) =>
          !/ROLE-LEVEL DIVERSITY|different species|different occupation|archetype/i.test(
            item,
          ),
      );
      return [
        "Suggest a DIFFERENT body part, a different physical condition, or a different object the subject could interact with.",
        "Do NOT vary only adjectives (plump/soft/rounded are synonym swaps).",
        ...filtered,
      ].join(" | ");
    }

    return ctx.focusGuidance || "";
  }

  private _isShotTypeCategory(category: string): boolean {
    return (
      this._normalizeCategoryKey(category) === "shot.type" ||
      this._normalizeCategoryKey(category) === "shot.framing"
    );
  }

  private _isBodyPartAppearanceCategory(
    category: string,
    highlightedText: string,
  ): boolean {
    return (
      this._normalizeCategoryKey(category) === "subject.appearance" &&
      CleanPromptBuilder.BODY_PART_TERMS.test(highlightedText)
    );
  }

  private _normalizeCategoryKey(category: string): string {
    return category.toLowerCase().replace(/[_-]/g, "");
  }

  private _filterFocusItems(items: string[], pattern: RegExp): string[] {
    return items.filter((item) => !pattern.test(item));
  }

  private _trim(text: string, length: number, fromEnd = false): string {
    if (!text) return "";
    if (text.length <= length) return text;
    return fromEnd ? text.slice(-length) : text.slice(0, length);
  }
}
