import type { Suggestion, VideoService } from "../services/types.js";
import type {
  SuggestionTestCase,
  SuggestionQualityDimension,
  SuggestionQualityResult,
  SuggestionQualityScores,
} from "./SuggestionQualityEvaluator.js";
import { SlotPolicyRegistry } from "../v2/SlotPolicyRegistry.js";
import { V2CandidateScorer } from "../v2/V2CandidateScorer.js";

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

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenSet(a);
  const setB = tokenSet(b);
  if (setA.size === 0 && setB.size === 0) return 0;
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function toFiveScale(score: number): number {
  if (score >= 0.75) return 5;
  if (score >= 0.6) return 4;
  if (score >= 0.45) return 3;
  if (score >= 0.25) return 2;
  return 1;
}

export class PolicyAwareSuggestionQualityEvaluator {
  private readonly registry: SlotPolicyRegistry;
  private readonly scorer: V2CandidateScorer;

  constructor(
    private readonly videoPromptService: VideoService,
    policyVersion = "2026-03-v2a",
  ) {
    this.registry = new SlotPolicyRegistry(policyVersion);
    this.scorer = new V2CandidateScorer(videoPromptService);
  }

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
    const isVideoPrompt = this.videoPromptService.isVideoPrompt(testCase.prompt);
    const policy = this.registry.resolve(testCase.span.category);
    const evaluations = this.scorer.scoreCandidates(
      validSuggestions,
      {
        highlightedText: testCase.span.text,
        contextBefore: testCase.contextBefore || "",
        contextAfter: testCase.contextAfter || "",
        fullPrompt: testCase.prompt,
        originalUserPrompt: testCase.prompt,
        brainstormContext: null,
        highlightedCategory: testCase.span.category,
        highlightedCategoryConfidence: null,
        isPlaceholder: false,
        isVideoPrompt,
        phraseRole: testCase.span.category,
        highlightWordCount: this.videoPromptService.countWords(testCase.span.text),
        videoConstraints: null,
        modelTarget: null,
        promptSection: null,
        spanAnchors: testCase.spanAnchors || "",
        nearbySpanHints: testCase.nearbySpanHints || "",
        lockedSpanCategories: testCase.lockedSpanCategories || [],
        debug: false,
      },
      policy,
    );

    const accepted = evaluations.filter((item) => item.accepted);
    const contextualFit = toFiveScale(
      texts.length > 0 ? accepted.length / texts.length : 0,
    );
    const categoryAlignment = toFiveScale(
      average(evaluations.map((item) => item.score.familyFit)),
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
      average(evaluations.map((item) => item.score.literalness)),
    );
    const sceneCoherence = toFiveScale(
      average(
        evaluations.map((item) => Math.max(0, 1 - item.score.overlapPenalty)),
      ),
    );

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
