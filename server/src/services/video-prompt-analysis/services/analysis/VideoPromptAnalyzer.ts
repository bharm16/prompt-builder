import { extractSemanticSpans } from '../../../../llm/span-labeling/nlp/NlpSpanService';
import SpanLabelingConfig from '../../../../llm/span-labeling/config/SpanLabelingConfig';
import type { VideoPromptIR } from '../../types';
import { createEmptyIR } from './IrFactory';
import { LlmIrExtractor } from './LlmIrExtractor';
import { parseInputStructure } from './InputStructureParser';
import { mapSpansToIR } from './SpanToIrMapper';
import { extractBasicHeuristics } from './HeuristicIrExtractor';
import { enrichFromTechnicalSpecs, enrichIR } from './IrEnricher';

interface VideoPromptAnalyzerDeps {
  llmExtractor?: LlmIrExtractor;
}

/**
 * Service responsible for analyzing raw text and extracting structured VideoPromptIR
 * Uses a hybrid approach:
 * 1. Deterministic structural parsing (Narrative vs Specs)
 * 2. Semantic Entity Extraction (GLiNER) for high-fidelity role detection
 */
export class VideoPromptAnalyzer {
  private readonly llmExtractor: LlmIrExtractor;

  constructor(deps: VideoPromptAnalyzerDeps = {}) {
    this.llmExtractor = deps.llmExtractor ?? new LlmIrExtractor();
  }

  /**
   * Analyze raw text and produce a structured Intermediate Representation (IR)
   *
   * @param text - The raw user input
   * @returns Structured VideoPromptIR
   */
  async analyze(text: string): Promise<VideoPromptIR> {
    const promptOutputOnly = process.env.PROMPT_OUTPUT_ONLY === 'true';
    const useGliner = !promptOutputOnly &&
      (SpanLabelingConfig.NEURO_SYMBOLIC?.ENABLED ?? false) &&
      (SpanLabelingConfig.NEURO_SYMBOLIC?.GLINER?.ENABLED ?? false);
    const llmParsed = promptOutputOnly ? null : await this.llmExtractor.tryAnalyze(text);

    if (llmParsed) {
      const cleanNarrative = this.cleanText(llmParsed.raw);
      try {
        const extractionResult = await extractSemanticSpans(cleanNarrative, { useGliner });
        const spans = Array.isArray(extractionResult.spans) ? extractionResult.spans : [];
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
      const extractionResult = await extractSemanticSpans(cleanNarrative, { useGliner });
      const spans = Array.isArray(extractionResult.spans) ? extractionResult.spans : [];
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

  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
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
