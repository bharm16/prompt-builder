import type { ModelScore, PromptRequirements } from '../types';

export class RecommendationExplainerService {
  explainRecommendation(score: ModelScore, _requirements: PromptRequirements): string {
    if (!score.factorScores.length) {
      return 'Balanced fit for general video generation requirements.';
    }

    const topFactors = [...score.factorScores]
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);

    const highlights = topFactors.map((factor) => factor.label.toLowerCase());

    if (highlights.length === 1) {
      return `Strong match for ${highlights[0]}.`;
    }

    return `Strong match for ${highlights[0]} and ${highlights[1]}.`;
  }

  explainEfficientOption(score: ModelScore): string {
    if (!score.factorScores.length) {
      return 'Efficient alternative with solid overall performance.';
    }

    const topFactor = [...score.factorScores].sort((a, b) => b.contribution - a.contribution)[0];
    if (!topFactor) {
      return 'Efficient alternative with solid overall performance.';
    }

    return `Efficient option that still performs well for ${topFactor.label.toLowerCase()}.`;
  }
}
