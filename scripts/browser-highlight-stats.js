/**
 * Browser Console Script for Highlighting Performance Stats
 *
 * Copy and paste this entire script into your browser console while on the app
 * Or save as a bookmarklet for quick access
 */

(function() {
  const colors = {
    reset: 'color: inherit',
    green: 'color: #10b981',
    red: 'color: #ef4444',
    yellow: 'color: #f59e0b',
    cyan: 'color: #06b6d4',
    magenta: 'color: #ec4899',
    bold: 'font-weight: bold',
    dim: 'opacity: 0.7',
  };

  function formatDuration(ms) {
    if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
    if (ms < 100) return `${ms.toFixed(2)}ms`;
    return `${ms.toFixed(0)}ms`;
  }

  function getColorForDuration(ms, thresholds = { good: 50, warning: 200 }) {
    if (ms <= thresholds.good) return colors.green;
    if (ms <= thresholds.warning) return colors.yellow;
    return colors.red;
  }

  console.clear();
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);
  console.log('%c       HIGHLIGHTING PERFORMANCE STATISTICS', `${colors.cyan}; ${colors.bold}; font-size: 16px`);
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

  // Extract metrics
  const allMeasures = performance.getEntriesByType('measure');
  const allMarks = performance.getEntriesByType('mark');

  // Group metrics by category
  const spanMetrics = allMeasures.filter(m =>
    m.name.includes('span') || m.name.includes('highlight')
  );

  const optimizationMetrics = allMeasures.filter(m =>
    m.name.includes('optimize') || m.name.includes('draft') || m.name.includes('refined')
  );

  // Extract specific metrics
  const criticalMetric = performance.getEntriesByName('CRITICAL-prompt-to-highlights', 'measure')[0];
  const cacheHits = performance.getEntriesByName('span-labeling-cache-hit', 'measure');
  const apiCalls = performance.getEntriesByName('span-api-duration', 'measure');
  const totalSpanLabeling = performance.getEntriesByName('span-labeling-total', 'measure');

  // Critical Metric
  console.group('%c🎯 CRITICAL METRIC (Prompt → Highlights)', colors.bold);
  if (criticalMetric) {
    const color = criticalMetric.duration <= 290 ? colors.green : criticalMetric.duration <= 600 ? colors.yellow : colors.red;
    const status = criticalMetric.duration <= 290 ? '✅ PASS' : '❌ FAIL';
    console.log(`%c${formatDuration(criticalMetric.duration)} ${status} (target: ≤290ms)`, color);
  } else {
    console.log('%cNo data - navigate to a prompt with highlights', colors.dim);
  }
  console.groupEnd();

  // Span Labeling Performance
  console.group('%c⚡ SPAN LABELING PERFORMANCE', colors.bold);

  // Cache Hits
  if (cacheHits.length > 0) {
    const avgCacheHit = cacheHits.reduce((a, b) => a + b.duration, 0) / cacheHits.length;
    const minCacheHit = Math.min(...cacheHits.map(h => h.duration));
    const maxCacheHit = Math.max(...cacheHits.map(h => h.duration));

    console.group('%cCache Hits', colors.green);
    console.log(`Count: ${cacheHits.length}`);
    console.log(`%cAvg: ${formatDuration(avgCacheHit)}`, colors.green);
    console.log(`Min: ${formatDuration(minCacheHit)} | Max: ${formatDuration(maxCacheHit)}`);
    console.groupEnd();
  }

  // API Calls
  if (apiCalls.length > 0) {
    const avgApiCall = apiCalls.reduce((a, b) => a + b.duration, 0) / apiCalls.length;
    const minApiCall = Math.min(...apiCalls.map(c => c.duration));
    const maxApiCall = Math.max(...apiCalls.map(c => c.duration));

    console.group('%cAPI Calls', colors.yellow);
    console.log(`Count: ${apiCalls.length}`);
    console.log(`%cAvg: ${formatDuration(avgApiCall)}`, getColorForDuration(avgApiCall, { good: 200, warning: 500 }));
    console.log(`Min: ${formatDuration(minApiCall)} | Max: ${formatDuration(maxApiCall)}`);
    console.groupEnd();
  }

  // Cache Hit Rate
  const totalRequests = cacheHits.length + apiCalls.length;
  if (totalRequests > 0) {
    const cacheHitRate = (cacheHits.length / totalRequests) * 100;
    const rateColor = cacheHitRate >= 70 ? colors.green : cacheHitRate >= 50 ? colors.yellow : colors.red;
    console.log(`%cCache Hit Rate: ${cacheHitRate.toFixed(1)}%`, `${colors.bold}; ${rateColor}`);
  }

  console.groupEnd();

  // Optimization Metrics
  const draftMetric = performance.getEntriesByName('optimize-to-draft', 'measure')[0];
  const refinedMetric = performance.getEntriesByName('draft-to-refined', 'measure')[0];
  const totalOptMetric = performance.getEntriesByName('optimize-to-refined-total', 'measure')[0];

  if (draftMetric || refinedMetric || totalOptMetric) {
    console.group('%c🚀 OPTIMIZATION PERFORMANCE', colors.bold);

    if (draftMetric) {
      console.log(`%cDraft Generation: ${formatDuration(draftMetric.duration)}`,
        getColorForDuration(draftMetric.duration, { good: 500, warning: 1000 }));
    }
    if (refinedMetric) {
      console.log(`%cRefinement: ${formatDuration(refinedMetric.duration)}`,
        getColorForDuration(refinedMetric.duration, { good: 5000, warning: 8000 }));
    }
    if (totalOptMetric) {
      console.log(`%cTotal Time: ${formatDuration(totalOptMetric.duration)}`,
        getColorForDuration(totalOptMetric.duration, { good: 6000, warning: 10000 }));
    }

    console.groupEnd();
  }

  // All span-related metrics
  if (spanMetrics.length > 0) {
    console.group('%c📊 ALL SPAN METRICS', colors.bold);
    const sortedMetrics = spanMetrics.sort((a, b) => b.duration - a.duration);
    const topMetrics = sortedMetrics.slice(0, 5);

    topMetrics.forEach(metric => {
      const color = getColorForDuration(metric.duration, { good: 100, warning: 500 });
      console.log(`%c${metric.name}: ${formatDuration(metric.duration)}`, color);
    });

    if (sortedMetrics.length > 5) {
      console.log(`%c... and ${sortedMetrics.length - 5} more metrics`, colors.dim);
    }
    console.groupEnd();
  }

  // Performance Marks
  if (allMarks.length > 0) {
    const uniqueMarks = [...new Set(allMarks.map(m => m.name))];
    console.group('%c🏁 PERFORMANCE MARKS AVAILABLE', colors.bold);
    console.log(`%c${uniqueMarks.join(', ')}`, colors.dim);
    console.groupEnd();
  }

  // Summary
  console.log('%c━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', colors.cyan);

  // Performance Grade
  let grade = 'A+';
  let gradeColor = colors.green;

  if (criticalMetric) {
    if (criticalMetric.duration > 600) {
      grade = 'C';
      gradeColor = colors.red;
    } else if (criticalMetric.duration > 400) {
      grade = 'B';
      gradeColor = colors.yellow;
    } else if (criticalMetric.duration > 290) {
      grade = 'B+';
      gradeColor = colors.yellow;
    } else if (criticalMetric.duration > 200) {
      grade = 'A';
      gradeColor = colors.green;
    }
  }

  console.log(`%cPerformance Grade: ${grade}`, `${colors.bold}; ${gradeColor}; font-size: 18px`);

  // Recommendations
  console.group('%c💡 Recommendations', colors.magenta);
  if (criticalMetric && criticalMetric.duration > 290) {
    console.log('• Highlighting is taking longer than target (290ms)');
    console.log('• Consider optimizing text parsing or reducing span complexity');
  }
  if (totalRequests > 0 && cacheHits.length / totalRequests < 0.7) {
    console.log('• Cache hit rate is below 70% - consider pre-warming cache');
  }
  if (apiCalls.length > 0 && Math.max(...apiCalls.map(c => c.duration)) > 1000) {
    console.log('• Some API calls are taking >1s - check network and server performance');
  }
  console.groupEnd();

  console.log('%c\nTip: Run this script again after navigating to collect more data', colors.dim);
  console.log('%cSave this as a bookmarklet for quick access!', colors.dim);

  // Return data for programmatic use
  return {
    critical: criticalMetric?.duration,
    cacheHits: cacheHits.map(h => h.duration),
    apiCalls: apiCalls.map(c => c.duration),
    cacheHitRate: totalRequests > 0 ? (cacheHits.length / totalRequests) * 100 : 0,
    grade,
  };
})();