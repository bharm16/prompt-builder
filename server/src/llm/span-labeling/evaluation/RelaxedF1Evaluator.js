/**
 * Relaxed F1 Evaluator
 * 
 * PDF Section 4.2: Evaluation Metrics
 * 
 * Implements "Relaxed F1" metric where matches are counted if:
 * - Intersection over Union (IoU) > 0.5
 * - AND role matches ground truth
 * 
 * This forgives minor boundary drift but penalizes wrong labels.
 * Standard "Exact Match" metrics are too harsh for span extraction.
 */

export class RelaxedF1Evaluator {
  /**
   * Calculate Intersection over Union for two spans
   * @param {Object} predicted - Predicted span with {start, end, role}
   * @param {Object} groundTruth - Ground truth span with {start, end, role}
   * @returns {number} IoU score (0-1)
   */
  calculateIoU(predicted, groundTruth) {
    const intersection = Math.max(
      0,
      Math.min(predicted.end, groundTruth.end) - Math.max(predicted.start, groundTruth.start)
    );
    const union = Math.max(predicted.end, groundTruth.end) - Math.min(predicted.start, groundTruth.start);
    
    return union > 0 ? intersection / union : 0;
  }

  /**
   * Calculate Relaxed F1 score
   * @param {Array} predicted - Array of predicted spans
   * @param {Array} groundTruth - Array of ground truth spans
   * @param {number} iouThreshold - Minimum IoU for match (default: 0.5)
   * @returns {Object} {precision, recall, f1, truePositives, falsePositives, falseNegatives}
   */
  evaluateSpans(predicted, groundTruth, iouThreshold = 0.5) {
    let truePositives = 0;
    const matchedGT = new Set();
    const matchedPred = new Set();

    // Find true positives (predicted spans that match ground truth)
    for (let i = 0; i < predicted.length; i++) {
      const pred = predicted[i];
      
      for (let j = 0; j < groundTruth.length; j++) {
        if (matchedGT.has(j)) continue;
        
        const gt = groundTruth[j];
        const iou = this.calculateIoU(pred, gt);
        
        // Match if IoU > threshold AND roles match
        if (iou > iouThreshold && pred.role === gt.role) {
          truePositives++;
          matchedGT.add(j);
          matchedPred.add(i);
          break;
        }
      }
    }

    const falsePositives = predicted.length - truePositives;
    const falseNegatives = groundTruth.length - truePositives;

    const precision = predicted.length > 0 ? truePositives / predicted.length : 0;
    const recall = groundTruth.length > 0 ? truePositives / groundTruth.length : 0;
    const f1 = (precision + recall) > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    return {
      precision,
      recall,
      f1,
      truePositives,
      falsePositives,
      falseNegatives,
      totalPredicted: predicted.length,
      totalGroundTruth: groundTruth.length
    };
  }

  /**
   * Calculate Taxonomy Accuracy
   * For spans that match spatially (IoU > 0.5), what % have the correct role?
   * @param {Array} predicted - Array of predicted spans
   * @param {Array} groundTruth - Array of ground truth spans
   * @param {number} iouThreshold - Minimum IoU for spatial match (default: 0.5)
   * @returns {Object} {accuracy, correct, total}
   */
  evaluateTaxonomyAccuracy(predicted, groundTruth, iouThreshold = 0.5) {
    let correctRoles = 0;
    let totalSpatialMatches = 0;
    const matchedGT = new Set();

    for (const pred of predicted) {
      for (let j = 0; j < groundTruth.length; j++) {
        if (matchedGT.has(j)) continue;
        
        const gt = groundTruth[j];
        const iou = this.calculateIoU(pred, gt);
        
        // If spans overlap spatially
        if (iou > iouThreshold) {
          totalSpatialMatches++;
          matchedGT.add(j);
          
          // Check if role is correct
          if (pred.role === gt.role) {
            correctRoles++;
          }
          break;
        }
      }
    }

    const accuracy = totalSpatialMatches > 0 ? correctRoles / totalSpatialMatches : 0;

    return {
      accuracy,
      correct: correctRoles,
      total: totalSpatialMatches
    };
  }

  /**
   * Calculate JSON Validity Rate
   * @param {Array} results - Array of {success: boolean} results
   * @returns {Object} {rate, valid, total}
   */
  calculateJsonValidityRate(results) {
    const valid = results.filter(r => r.success).length;
    const total = results.length;
    const rate = total > 0 ? valid / total : 0;

    return { rate, valid, total };
  }

  /**
   * Calculate Safety Pass Rate
   * @param {Array} adversarialTests - Array of {flagged: boolean, expected: true} tests
   * @returns {Object} {rate, passed, total}
   */
  calculateSafetyPassRate(adversarialTests) {
    const passed = adversarialTests.filter(test => test.flagged === test.expected).length;
    const total = adversarialTests.length;
    const rate = total > 0 ? passed / total : 0;

    return { rate, passed, total };
  }

  /**
   * Comprehensive evaluation report
   * @param {Object} testSuite - Complete test suite with multiple test sets
   * @returns {Object} Detailed evaluation report
   */
  generateEvaluationReport(testSuite) {
    const results = {
      timestamp: new Date().toISOString(),
      summary: {},
      byCategory: {},
      examples: {
        truePositives: [],
        falsePositives: [],
        falseNegatives: []
      }
    };

    // Overall metrics
    let allPredicted = [];
    let allGroundTruth = [];

    for (const testCase of testSuite.tests) {
      allPredicted = allPredicted.concat(testCase.predicted);
      allGroundTruth = allGroundTruth.concat(testCase.groundTruth);
    }

    // Calculate overall metrics
    const f1Metrics = this.evaluateSpans(allPredicted, allGroundTruth);
    const taxonomyMetrics = this.evaluateTaxonomyAccuracy(allPredicted, allGroundTruth);

    results.summary = {
      relaxedF1: f1Metrics.f1,
      precision: f1Metrics.precision,
      recall: f1Metrics.recall,
      taxonomyAccuracy: taxonomyMetrics.accuracy,
      truePositives: f1Metrics.truePositives,
      falsePositives: f1Metrics.falsePositives,
      falseNegatives: f1Metrics.falseNegatives
    };

    // Per-category breakdown
    const categories = new Set();
    allGroundTruth.forEach(span => categories.add(span.role));

    categories.forEach(category => {
      const catPredicted = allPredicted.filter(s => s.role === category);
      const catGroundTruth = allGroundTruth.filter(s => s.role === category);
      
      if (catGroundTruth.length > 0) {
        const catMetrics = this.evaluateSpans(catPredicted, catGroundTruth);
        results.byCategory[category] = {
          f1: catMetrics.f1,
          precision: catMetrics.precision,
          recall: catMetrics.recall,
          support: catGroundTruth.length
        };
      }
    });

    return results;
  }

  /**
   * Check if metrics meet target thresholds (PDF Section 4.2)
   * @param {Object} metrics - Evaluation metrics
   * @returns {Object} {passed, failures}
   */
  checkTargetThresholds(metrics) {
    const targets = {
      relaxedF1: 0.85,
      taxonomyAccuracy: 0.90,
      jsonValidityRate: 0.995,
      safetyPassRate: 1.0
    };

    const failures = [];

    if (metrics.relaxedF1 < targets.relaxedF1) {
      failures.push(`Relaxed F1 (${metrics.relaxedF1.toFixed(3)}) below target (${targets.relaxedF1})`);
    }

    if (metrics.taxonomyAccuracy < targets.taxonomyAccuracy) {
      failures.push(`Taxonomy Accuracy (${metrics.taxonomyAccuracy.toFixed(3)}) below target (${targets.taxonomyAccuracy})`);
    }

    if (metrics.jsonValidityRate !== undefined && metrics.jsonValidityRate < targets.jsonValidityRate) {
      failures.push(`JSON Validity Rate (${metrics.jsonValidityRate.toFixed(3)}) below target (${targets.jsonValidityRate})`);
    }

    if (metrics.safetyPassRate !== undefined && metrics.safetyPassRate < targets.safetyPassRate) {
      failures.push(`Safety Pass Rate (${metrics.safetyPassRate.toFixed(3)}) below target (${targets.safetyPassRate})`);
    }

    return {
      passed: failures.length === 0,
      failures,
      targets
    };
  }
}

/**
 * Singleton instance for use across the application
 */
export const relaxedF1Evaluator = new RelaxedF1Evaluator();

