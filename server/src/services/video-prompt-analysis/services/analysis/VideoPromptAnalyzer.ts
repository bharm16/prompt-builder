import { extractSemanticSpans } from "../../../../llm/span-labeling/nlp/NlpSpanService";
import SpanLabelingConfig from "../../../../llm/span-labeling/config/SpanLabelingConfig";
import type { VideoPromptStructuredResponse } from "@server/contracts/prompt-analysis/structuredPrompt";
import type { VideoPromptIR } from "../../types";
import { createEmptyIR } from "./IrFactory";
import { LlmIrExtractor } from "./LlmIrExtractor";
import { parseInputStructure } from "./InputStructureParser";
import { mapSpansToIR } from "./SpanToIrMapper";
import { extractBasicHeuristics } from "./HeuristicIrExtractor";
import { enrichFromTechnicalSpecs, enrichIR } from "./IrEnricher";

interface VideoPromptAnalyzerDeps {
  llmExtractor?: LlmIrExtractor;
  promptOutputOnly?: boolean;
}

/**
 * Service responsible for analyzing raw text and extracting structured VideoPromptIR
 * Uses a hybrid approach:
 * 1. Deterministic structural parsing (Narrative vs Specs)
 * 2. Semantic Entity Extraction (GLiNER) for high-fidelity role detection
 */
export class VideoPromptAnalyzer {
  private readonly llmExtractor: LlmIrExtractor;
  private readonly promptOutputOnly: boolean;

  constructor(deps: VideoPromptAnalyzerDeps = {}) {
    this.llmExtractor = deps.llmExtractor ?? new LlmIrExtractor();
    this.promptOutputOnly = deps.promptOutputOnly ?? false;
  }

  /**
   * Analyze raw text and produce a structured Intermediate Representation (IR)
   *
   * @param text - The raw user input
   * @returns Structured VideoPromptIR
   */
  async analyze(text: string): Promise<VideoPromptIR> {
    const promptOutputOnly = this.promptOutputOnly;
    const useGliner =
      !promptOutputOnly &&
      (SpanLabelingConfig.NEURO_SYMBOLIC?.ENABLED ?? false) &&
      (SpanLabelingConfig.NEURO_SYMBOLIC?.GLINER?.ENABLED ?? false);
    const llmParsed = promptOutputOnly
      ? null
      : await this.llmExtractor.tryAnalyze(text);

    if (llmParsed) {
      const cleanNarrative = this.cleanText(llmParsed.raw);
      try {
        const extractionResult = await extractSemanticSpans(cleanNarrative, {
          useGliner,
        });
        const spans = Array.isArray(extractionResult.spans)
          ? extractionResult.spans
          : [];
        mapSpansToIR(spans, llmParsed);
      } catch {
        if (this.isIrSparse(llmParsed)) {
          extractBasicHeuristics(cleanNarrative, llmParsed);
        }
      }
      if (llmParsed.technical && Object.keys(llmParsed.technical).length > 0) {
        enrichFromTechnicalSpecs(llmParsed.technical, llmParsed);
      }
      enrichIR(llmParsed);
      return llmParsed;
    }

    const ir = createEmptyIR(text);

    // 1. Structural Parsing (Markdown headers / JSON)
    const sections = parseInputStructure(text);
    ir.raw = sections.narrative;
    const cleanNarrative = this.cleanText(sections.narrative);

    // 2. Semantic Extraction (Tier 2 NLP: GLiNER)
    // We use the existing high-fidelity NLP service to detect roles semantically
    try {
      // Use the project's established ML pipeline for open-vocabulary extraction
      const extractionResult = await extractSemanticSpans(cleanNarrative, {
        useGliner,
      });
      const spans = Array.isArray(extractionResult.spans)
        ? extractionResult.spans
        : [];
      mapSpansToIR(spans, ir);
    } catch {
      // Fallback to basic heuristics if the ML service is unavailable
      extractBasicHeuristics(cleanNarrative, ir);
    }

    // 3. Structured Enrichment (From Technical Specs)
    if (sections.technical) {
      ir.technical = sections.technical;
      enrichFromTechnicalSpecs(sections.technical, ir);
    }

    // 4. Basic Inference Enrichment
    enrichIR(ir);

    return ir;
  }

  fromStructuredPrompt(
    structuredPrompt: VideoPromptStructuredResponse,
    sourcePrompt: string,
  ): VideoPromptIR {
    const ir = createEmptyIR(sourcePrompt);
    const normalizedSource = this.cleanText(sourcePrompt);

    if (structuredPrompt.subject) {
      ir.subjects.push({
        text: structuredPrompt.subject.trim(),
        attributes: (structuredPrompt.subject_details ?? [])
          .map((detail) => detail.trim())
          .filter(Boolean),
      });
    }

    if (structuredPrompt.action) {
      ir.actions.push(structuredPrompt.action.trim());
    }

    if (structuredPrompt.camera_move) {
      ir.camera.movements.push(structuredPrompt.camera_move.trim());
    }

    if (structuredPrompt.camera_angle) {
      ir.camera.angle = structuredPrompt.camera_angle.trim();
    }

    if (structuredPrompt.shot_framing) {
      ir.camera.shotType = structuredPrompt.shot_framing.trim();
    }

    if (structuredPrompt.setting) {
      ir.environment.setting = structuredPrompt.setting.trim();
    }

    if (structuredPrompt.lighting) {
      ir.environment.lighting.push(structuredPrompt.lighting.trim());
    }

    if (structuredPrompt.style) {
      ir.meta.style.push(structuredPrompt.style.trim());
    }

    if (structuredPrompt.time) {
      ir.meta.temporal = [structuredPrompt.time.trim()];
    }

    if (structuredPrompt.technical_specs) {
      for (const [key, value] of Object.entries(
        structuredPrompt.technical_specs,
      )) {
        if (typeof value === "string" && value.trim().length > 0) {
          ir.technical[key] = value.trim();
        }
      }
    }

    const dialogueMatch = normalizedSource.match(/["']([^"']+)["']/);
    if (dialogueMatch?.[1]) {
      ir.audio.dialogue = dialogueMatch[1].trim();
    }

    const musicMatch = normalizedSource.match(
      /\b(?:music|score|soundtrack|melody)\b[^.!?]*/i,
    );
    if (musicMatch?.[0]) {
      ir.audio.music = musicMatch[0].trim();
    }

    const sfxMatch = normalizedSource.match(
      /\b(?:sfx|sound effect|thunder|rain|footsteps|explosion|voiceover)\b[^.!?]*/i,
    );
    if (sfxMatch?.[0]) {
      ir.audio.sfx = sfxMatch[0].trim();
    }

    extractBasicHeuristics(normalizedSource, ir);
    enrichIR(ir);

    return ir;
  }

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, " ");
  }

  private isIrSparse(ir: VideoPromptIR): boolean {
    return (
      ir.subjects.length === 0 &&
      ir.actions.length === 0 &&
      ir.camera.movements.length === 0 &&
      !ir.camera.angle &&
      !ir.camera.shotType &&
      !ir.environment.setting &&
      ir.environment.lighting.length === 0 &&
      !ir.environment.weather &&
      ir.meta.mood.length === 0 &&
      ir.meta.style.length === 0
    );
  }
}
