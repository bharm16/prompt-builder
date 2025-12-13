import type { Suggestion } from '../services/types.js';
import type { TextCategorizerService } from '../../text-categorization/TextCategorizerService.ts';
import type { VideoPromptService } from '../../video-prompt-analysis/VideoPromptService.ts';
import type { SuggestionValidationService } from '../services/SuggestionValidationService.ts';

export interface SuggestionTestCase {
  id: string;
  prompt: string;
  span: { text: string; category: string };
  allowedCategories?: string[];
  forbiddenOutputs?: string[];
  expectedQualities?: Partial<Record<SuggestionQualityDimension, { min?: number; max?: number }>>;
}

export type SuggestionQualityDimension =
  | 'categoryCoherence'
  | 'diversity'
  | 'nonRepetition'
  | 'syntacticValidity'
  | 'lengthAppropriateness';

export interface SuggestionQualityScores {
  categoryCoherence: number;
  diversity: number;
  nonRepetition: number;
  syntacticValidity: number;
  lengthAppropriateness: number;
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
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
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

function lengthAppropriatenessScore(original: string, suggestion: string): number {
  const ratio = suggestion.length / Math.max(1, original.length);
  if (ratio >= 0.5 && ratio <= 2.0) return 1.0;
  if (ratio >= 0.3 && ratio <= 3.0) return 0.7;
  return 0.3;
}

export class SuggestionQualityEvaluator {
  constructor(
    private readonly validationService: SuggestionValidationService,
    private readonly videoService: VideoPromptService,
    private readonly classifier?: TextCategorizerService
  ) {}

  private async inferParentCategory(suggestion: Suggestion, fallbackText: string): Promise<string | null> {
    if (suggestion.category && typeof suggestion.category === 'string') {
      return suggestion.category.toLowerCase();
    }

    if (!this.classifier) return null;

    try {
      const spans = await this.classifier.parseText({ text: fallbackText });
      if (!spans || spans.length === 0) return null;

      const counts: Record<string, number> = {};
      spans.forEach((s) => {
        const key = (s.category || '').toLowerCase();
        if (!key) return;
        counts[key] = (counts[key] || 0) + 1;
      });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      return top ? top[0] : null;
    } catch {
      return null;
    }
  }

  async evaluateCase(testCase: SuggestionTestCase, suggestions: Suggestion[]): Promise<SuggestionQualityResult> {
    const failures: string[] = [];

    const originalText = testCase.span.text;
    const allowedParents = (testCase.allowedCategories && testCase.allowedCategories.length > 0
      ? testCase.allowedCategories
      : [testCase.span.category]
    ).map((c) => c.toLowerCase());

    const validSuggestions = suggestions.filter((s) => typeof s?.text === 'string' && s.text.trim());
    const texts = validSuggestions.map((s) => s.text.trim());

    // Category coherence
    let coherentCount = 0;
    for (let i = 0; i < validSuggestions.length; i++) {
      const parent = await this.inferParentCategory(validSuggestions[i]!, texts[i]!);
      if (parent && allowedParents.includes(parent)) coherentCount++;
    }
    const categoryCoherence = texts.length > 0 ? coherentCount / texts.length : 0;

    // Diversity (1 - average pairwise similarity)
    let diversity = 1;
    if (texts.length >= 2) {
      let totalSim = 0;
      let pairs = 0;
      for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
          totalSim += jaccardSimilarity(texts[i]!, texts[j]!);
          pairs++;
        }
      }
      const avgSim = pairs > 0 ? totalSim / pairs : 0;
      diversity = 1 - avgSim;
    }

    // Non-repetition vs original
    const nonRepetitionScores = texts.map((t) => 1 - jaccardSimilarity(originalText, t));
    const nonRepetition =
      nonRepetitionScores.length > 0
        ? nonRepetitionScores.reduce((a, b) => a + b, 0) / nonRepetitionScores.length
        : 0;

    // Syntactic validity = survives sanitization
    const isVideoPrompt = this.videoService.isVideoPrompt(testCase.prompt);
    const sanitized = this.validationService.sanitizeSuggestions(validSuggestions, {
      highlightedText: originalText,
      isPlaceholder: false,
      isVideoPrompt,
    });
    const syntacticValidity = texts.length > 0 ? sanitized.length / texts.length : 0;

    // Length appropriateness
    const lengthScores = texts.map((t) => lengthAppropriatenessScore(originalText, t));
    const lengthAppropriateness =
      lengthScores.length > 0 ? lengthScores.reduce((a, b) => a + b, 0) / lengthScores.length : 0;

    // Forbidden outputs
    if (testCase.forbiddenOutputs && testCase.forbiddenOutputs.length) {
      const forbidden = testCase.forbiddenOutputs.map(normalizeText);
      texts.forEach((t) => {
        if (forbidden.includes(normalizeText(t))) {
          failures.push(`Forbidden output produced: "${t}"`);
        }
      });
    }

    const scores: SuggestionQualityScores = {
      categoryCoherence,
      diversity,
      nonRepetition,
      syntacticValidity,
      lengthAppropriateness,
    };

    // Expected quality ranges (optional)
    if (testCase.expectedQualities) {
      for (const [dim, range] of Object.entries(testCase.expectedQualities)) {
        const value = scores[dim as SuggestionQualityDimension];
        if (range?.min !== undefined && value < range.min) {
          failures.push(`${dim} (${value.toFixed(3)}) below min ${range.min}`);
        }
        if (range?.max !== undefined && value > range.max) {
          failures.push(`${dim} (${value.toFixed(3)}) above max ${range.max}`);
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

