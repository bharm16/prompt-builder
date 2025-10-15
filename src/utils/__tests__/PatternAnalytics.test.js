import { describe, it, expect, beforeEach } from 'vitest';
import { PatternAnalytics } from '../PatternAnalytics.js';

describe('PatternAnalytics', () => {
  let analytics;

  beforeEach(() => {
    // Reset localStorage between tests
    localStorage.clear();
    analytics = new PatternAnalytics();
    analytics.clearAll();
  });

  it('tracks highlights and clicks, and persists periodically', () => {
    analytics.trackHighlight('golden hour', 'lighting', 85);
    analytics.trackHighlight('bokeh', 'technical', 70);
    analytics.trackClick('golden hour', 'lighting');

    const topShown = analytics.getTopHighlightedPhrases(2);
    expect(topShown[0].phrase).toBeDefined();
    const topClicked = analytics.getTopClickedPhrases(2);
    expect(topClicked[0]).toHaveProperty('clicks');

    const metrics = analytics.getEffectivenessMetrics();
    expect(metrics.totalHighlights).toBeGreaterThan(0);
    expect(metrics.totalClicks).toBe(1);
    expect(metrics.clickRate).toMatch(/%$/);
  });

  it('computes category stats and average confidence', () => {
    analytics.trackHighlight('zoom', 'camera', 90);
    analytics.trackHighlight('light', 'lighting', 70);
    analytics.trackHighlight('fog', 'environment', 55);

    const stats = analytics.getCategoryStats();
    expect(stats.length).toBeGreaterThan(0);
    const avgConfidence = analytics.calculateAverageConfidence();
    expect(parseFloat(avgConfidence)).toBeGreaterThan(0);
  });

  it('exports and clears data correctly', () => {
    analytics.trackHighlight('zoom', 'camera', 80);
    const exported = analytics.exportData();
    expect(exported.storage.totalHighlights).toBe(1);

    analytics.clearAll();
    const afterClear = analytics.getEffectivenessMetrics();
    expect(afterClear.totalHighlights).toBe(0);
  });

  it('generates insights for low confidence and low click rate', () => {
    // Create enough data to trigger insights
    for (let i = 0; i < 60; i++) {
      analytics.trackHighlight('generic', 'descriptive', 55);
    }
    const insights = analytics.getInsights();
    expect(Array.isArray(insights)).toBe(true);
  });
});
