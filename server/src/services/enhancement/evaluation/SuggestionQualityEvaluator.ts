import type { Suggestion } from "../services/types.js";
import type { VideoPromptService } from "@services/video-prompt-analysis/VideoPromptService";
import type { SuggestionValidationService } from "../services/SuggestionValidationService.ts";

export interface SuggestionTestCase {
  id: string;
  prompt: string;
  span: { text: string; category: string };
  allowedCategories?: string[];
  forbiddenOutputs?: string[];
  expectedQualities?: Partial<
    Record<SuggestionQualityDimension, { min?: number; max?: number }>
  >;
  contextBefore?: string;
  contextAfter?: string;
  spanAnchors?: string;
  nearbySpanHints?: string;
  lockedSpanCategories?: string[];
}

export type SuggestionQualityDimension =
  | "contextualFit"
  | "categoryAlignment"
  | "diversity"
  | "videoSpecificity"
  | "sceneCoherence";

export interface SuggestionQualityScores {
  contextualFit: number;
  categoryAlignment: number;
  diversity: number;
  videoSpecificity: number;
  sceneCoherence: number;
}

export interface SuggestionQualityResult {
  id: string;
  scores: SuggestionQualityScores;
  passed: boolean;
  failures: string[];
  suggestions: Suggestion[];
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(text: string): Set<string> {
  return new Set(normalizeText(text).split(/\s+/).filter(Boolean));
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toFiveScale(score: number): number {
  if (score >= 0.75) return 5;
  if (score >= 0.6) return 4;
  if (score >= 0.45) return 3;
  if (score >= 0.25) return 2;
  return 1;
}

export class SuggestionQualityEvaluator {
  private readonly visibleConcreteTerms =
    /\b(face|hands?|fingers?|palms?|eyes?|skin|freckles|curls|cheeks?|hair|toddler|child|kid|wheel|window|dashboard|glass|trees?|park|street|forest|beach|meadow|trail|lakeside|turnout|shadow|shadowed|glow|glowing|light|lit|sunlit|grain|bokeh|blur|close[-\s]?up|wide shot|low[-\s]?angle|high[-\s]?angle|overhead|viewpoint|perspective|dolly|pan|tilt|crane|lens|aperture|f-number|mm|film|filter|filtered|monochrome|watercolor|diffusion|diffused|fog|dust|smoke|reflection|sunset|sunrise|dawn|dusk|twilight|blue hour|afternoon|morning|night|rain|snow|leather|metal|wood|plastic|softly|gently|brightly|warmly|harshly|dimly)\b/i;
  private readonly abstractTerms =
    /\b(memory|recollection|sentimentality|mood|feeling|emotion|essence|spirit|timelessness|intimacy|wonder|beauty)\b/i;

  constructor(
    private readonly validationService: SuggestionValidationService,
    private readonly videoService: VideoPromptService,
  ) {}

  async evaluateCase(
    testCase: SuggestionTestCase,
    suggestions: Suggestion[],
  ): Promise<SuggestionQualityResult> {
    const failures: string[] = [];
    const validSuggestions = suggestions.filter(
      (suggestion) =>
        typeof suggestion?.text === "string" && suggestion.text.trim(),
    );
    const texts = validSuggestions.map((suggestion) => suggestion.text.trim());

    const allowedCategories = (
      testCase.allowedCategories && testCase.allowedCategories.length > 0
        ? testCase.allowedCategories
        : [testCase.span.category]
    ).map((category) => category.toLowerCase());

    const isVideoPrompt = this.videoService.isVideoPrompt(testCase.prompt);
    const sanitizationContext: Record<string, unknown> = {
      highlightedText: testCase.span.text,
      highlightedCategory: testCase.span.category,
      isPlaceholder: false,
      isVideoPrompt,
    };
    if (testCase.contextBefore !== undefined) {
      sanitizationContext.contextBefore = testCase.contextBefore;
    }
    if (testCase.contextAfter !== undefined) {
      sanitizationContext.contextAfter = testCase.contextAfter;
    }
    if (testCase.spanAnchors !== undefined) {
      sanitizationContext.spanAnchors = testCase.spanAnchors;
    }
    if (testCase.nearbySpanHints !== undefined) {
      sanitizationContext.nearbySpanHints = testCase.nearbySpanHints;
    }
    if (testCase.lockedSpanCategories !== undefined) {
      sanitizationContext.lockedSpanCategories = testCase.lockedSpanCategories;
    }

    const contextuallyValid = this.validationService.sanitizeSuggestions(
      validSuggestions,
      sanitizationContext as Parameters<
        SuggestionValidationService["sanitizeSuggestions"]
      >[1],
    );
    const coherentSuggestions = this.validationService.sanitizeSuggestions(
      validSuggestions,
      {
        ...sanitizationContext,
      } as Parameters<SuggestionValidationService["sanitizeSuggestions"]>[1],
    );
    const categoryValid = this.validationService.validateSuggestions(
      validSuggestions,
      testCase.span.text,
      testCase.span.category,
    );
    const categoryValidTextSet = new Set(
      categoryValid.map((suggestion) => normalizeText(suggestion.text)),
    );

    const contextualFit = toFiveScale(
      texts.length > 0 ? contextuallyValid.length / texts.length : 0,
    );
    const categoryAlignment = toFiveScale(
      texts.length > 0
        ? validSuggestions.filter((suggestion) => {
            const normalizedCategory = String(
              suggestion.category || "",
            ).toLowerCase();
            return (
              allowedCategories.includes(normalizedCategory) &&
              categoryValidTextSet.has(normalizeText(suggestion.text))
            );
          }).length / texts.length
        : 0,
    );

    let diversityRatio = 1;
    if (texts.length >= 2) {
      let totalSimilarity = 0;
      let pairCount = 0;
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          totalSimilarity += jaccardSimilarity(texts[i]!, texts[j]!);
          pairCount += 1;
        }
      }
      diversityRatio = 1 - (pairCount > 0 ? totalSimilarity / pairCount : 0);
    }

    const diversity = toFiveScale(diversityRatio);
    const videoSpecificity = toFiveScale(
      average(
        texts.map((text) => {
          const hasConcreteCue = this.visibleConcreteTerms.test(text);
          const hasAbstractCue = this.abstractTerms.test(text);
          if (hasConcreteCue && !hasAbstractCue) return 1;
          if (hasConcreteCue) return 0.7;
          if (!hasAbstractCue) return 0.45;
          return 0.2;
        }),
      ),
    );
    const sceneCoherence = toFiveScale(
      texts.length > 0 ? coherentSuggestions.length / texts.length : 0,
    );

    if (testCase.forbiddenOutputs && testCase.forbiddenOutputs.length > 0) {
      const forbidden = testCase.forbiddenOutputs.map(normalizeText);
      texts.forEach((text) => {
        if (forbidden.includes(normalizeText(text))) {
          failures.push(`Forbidden output produced: "${text}"`);
        }
      });
    }

    const scores: SuggestionQualityScores = {
      contextualFit,
      categoryAlignment,
      diversity,
      videoSpecificity,
      sceneCoherence,
    };

    if (testCase.expectedQualities) {
      for (const [dimension, range] of Object.entries(
        testCase.expectedQualities,
      )) {
        const value = scores[dimension as SuggestionQualityDimension];
        if (range?.min !== undefined && value < range.min) {
          failures.push(
            `${dimension} (${value.toFixed(1)}) below min ${range.min}`,
          );
        }
        if (range?.max !== undefined && value > range.max) {
          failures.push(
            `${dimension} (${value.toFixed(1)}) above max ${range.max}`,
          );
        }
      }
    }

    return {
      id: testCase.id,
      scores,
      passed: failures.length === 0,
      failures,
      suggestions: validSuggestions,
    };
  }
}
