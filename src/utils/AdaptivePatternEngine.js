/**
 * Adaptive Pattern Discovery Engine
 *
 * Orchestrates the intelligent pattern recognition system:
 * - Extracts important phrases automatically
 * - Categorizes them semantically
 * - Learns from user behavior
 * - Adapts over time
 * - No hardcoded patterns needed!
 */

import { intelligentExtractor } from './IntelligentPhraseExtractor.js';
import { semanticCategorizer } from './SemanticCategorizer.js';
import { behaviorLearner } from './BehaviorLearningEngine.js';
import { fuzzyMatcher } from './FuzzyMatcher.js';

export class AdaptivePatternEngine {
  constructor() {
    this.minConfidence = 50; // Minimum confidence to show
    this.maxHighlights = 100; // Maximum highlights per text

    // Performance tracking
    this.processingTimes = [];

    // Initialize sub-systems
    this.extractor = intelligentExtractor;
    this.categorizer = semanticCategorizer;
    this.learner = behaviorLearner;
    this.fuzzy = fuzzyMatcher;

    // Load previous learning
    this.extractor.load();
  }

  /**
   * Main entry point: Process text and return highlighted matches
   */
  processText(text) {
    const startTime = performance.now();

    // Step 1: Auto-correct typos
    const correctedText = this.fuzzy.autoCorrect(text);

    // Step 2: Extract important phrases using TF-IDF and statistical analysis
    const importantPhrases = this.extractor.extractImportantPhrases(
      correctedText,
      0.1 // Minimum score threshold
    );

    // Step 3: Find all occurrences of these phrases in the text
    const phraseOccurrences = this.extractor.findPhraseOccurrences(
      correctedText,
      importantPhrases.slice(0, 50) // Top 50 phrases to avoid over-highlighting
    );

    // Step 4: Categorize each occurrence semantically
    const categorizedMatches = phraseOccurrences.map(match => {
      const { category, confidence, color } = this.categorizer.categorize(
        match.phrase,
        correctedText,
        match.start
      );

      return {
        ...match,
        category,
        baseConfidence: confidence,
        color
      };
    });

    // Step 5: Apply behavior learning to adjust confidence
    const learnedMatches = categorizedMatches.map(match => {
      const adjustedConfidence = this.learner.adjustConfidence(
        match.phrase,
        match.category,
        match.baseConfidence
      );

      return {
        ...match,
        confidence: adjustedConfidence
      };
    });

    // Step 6: Filter by learned preferences
    const filteredMatches = learnedMatches.filter(match =>
      this.learner.shouldShow(match.phrase, match.category, match.confidence)
    );

    // Step 7: Resolve overlaps (prefer longer, higher-confidence matches)
    const resolvedMatches = this.resolveOverlaps(filteredMatches);

    // Step 8: Sort and limit
    const finalMatches = resolvedMatches
      .sort((a, b) => a.start - b.start)
      .slice(0, this.maxHighlights);

    // Track processing time
    const endTime = performance.now();
    this.processingTimes.push(endTime - startTime);
    if (this.processingTimes.length > 100) {
      this.processingTimes.shift();
    }

    // Update statistics
    this.extractor.updateStatistics(correctedText);

    return {
      matches: finalMatches,
      stats: {
        phrasesExtracted: importantPhrases.length,
        occurrencesFound: phraseOccurrences.length,
        afterFiltering: filteredMatches.length,
        finalHighlights: finalMatches.length,
        processingTime: (endTime - startTime).toFixed(2) + 'ms'
      }
    };
  }

  /**
   * Resolve overlapping matches (prefer longer, higher-confidence matches)
   */
  resolveOverlaps(matches) {
    const sorted = matches.sort((a, b) => {
      // Sort by confidence first, then length
      if (Math.abs(a.confidence - b.confidence) > 5) {
        return b.confidence - a.confidence;
      }
      return b.length - a.length;
    });

    const resolved = [];

    sorted.forEach(match => {
      // Check if this overlaps with any already selected
      const hasOverlap = resolved.some(existing =>
        !(match.end <= existing.start || match.start >= existing.end)
      );

      if (!hasOverlap) {
        resolved.push(match);
      }
    });

    return resolved;
  }

  /**
   * Record that a highlight was shown
   */
  recordShown(phrase, category, confidence) {
    this.learner.recordShown(phrase, category, confidence);
    this.categorizer.updateCooccurrence(phrase, category, 0.5);
  }

  /**
   * Record that user clicked a highlight
   */
  recordClick(phrase, category) {
    this.learner.recordClick(phrase, category);
    this.categorizer.updateCooccurrence(phrase, category, 2);
  }

  /**
   * Record that user ignored a highlight
   */
  recordIgnored(phrase) {
    this.learner.recordIgnored(phrase);
  }

  /**
   * User manually recategorizes a highlight (strong learning signal)
   */
  recordRecategorization(phrase, oldCategory, newCategory) {
    this.categorizer.learnFromUserCorrection(phrase, newCategory);
    this.learner.recordClick(phrase, newCategory);
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const avgProcessingTime = this.processingTimes.length > 0
      ? (this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length).toFixed(2)
      : 0;

    return {
      extractor: this.extractor.getStatistics(),
      categorizer: this.categorizer.getStatistics(),
      learner: this.learner.getStatistics(),
      performance: {
        averageProcessingTime: avgProcessingTime + 'ms',
        samples: this.processingTimes.length
      }
    };
  }

  /**
   * Get insights about system performance
   */
  getInsights() {
    const insights = [];

    // Learning insights
    const learnerInsights = this.learner.getInsights();
    insights.push(...learnerInsights);

    // Extractor insights
    const extractorStats = this.extractor.getStatistics();
    if (extractorStats.totalDocuments < 10) {
      insights.push({
        type: 'info',
        category: 'learning',
        message: 'System is still learning patterns from your text',
        suggestion: 'Process more documents to improve pattern recognition'
      });
    }

    // Performance insights
    const avgTime = this.processingTimes.length > 0
      ? this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length
      : 0;

    if (avgTime > 100) {
      insights.push({
        type: 'warning',
        category: 'performance',
        message: `Average processing time is ${avgTime.toFixed(0)}ms`,
        suggestion: 'Consider reducing maxHighlights or minimum score threshold'
      });
    }

    return insights;
  }

  /**
   * Get top performing patterns
   */
  getTopPatterns(n = 20) {
    return this.learner.getTopPhrases(n);
  }

  /**
   * Get category performance
   */
  getCategoryPerformance() {
    return this.learner.getCategoryMetrics();
  }

  /**
   * Export all system data for analysis
   */
  exportData() {
    return {
      statistics: this.getStatistics(),
      insights: this.getInsights(),
      topPatterns: this.getTopPatterns(50),
      categoryPerformance: this.getCategoryPerformance(),
      extractorData: this.extractor.getStatistics(),
      categorizerData: this.categorizer.getStatistics(),
      learnerData: this.learner.exportData()
    };
  }

  /**
   * Adjust system parameters
   */
  configure({ minConfidence, maxHighlights, learningRate, explorationRate }) {
    if (minConfidence !== undefined) {
      this.minConfidence = Math.max(0, Math.min(100, minConfidence));
    }
    if (maxHighlights !== undefined) {
      this.maxHighlights = Math.max(1, maxHighlights);
    }
    if (learningRate !== undefined) {
      this.learner.setLearningRate(learningRate);
    }
    if (explorationRate !== undefined) {
      this.learner.setExplorationRate(explorationRate);
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration() {
    return {
      minConfidence: this.minConfidence,
      maxHighlights: this.maxHighlights,
      learningRate: this.learner.learningRate,
      explorationRate: this.learner.explorationRate
    };
  }

  /**
   * Reset all learning (fresh start)
   */
  resetLearning() {
    this.extractor.reset();
    this.categorizer.reset();
    this.learner.reset();
    this.processingTimes = [];
  }

  /**
   * Save all state
   */
  save() {
    this.extractor.save();
    this.categorizer.save();
    this.learner.save();
  }
}

// Export singleton
export const adaptiveEngine = new AdaptivePatternEngine();
