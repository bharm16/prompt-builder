/**
 * Performance Testing Utilities for Span Highlighting
 * 
 * Provides utilities to measure and test the performance improvements
 * from the span highlighting optimizations:
 * - Diff-based DOM rendering
 * - Trusted backend validation
 * - Memoization and debouncing
 * 
 * USAGE:
 * ```js
 * import { generateTestSpans, measureRenderPerformance } from './performanceTesting.js';
 * 
 * const testSpans = generateTestSpans(60); // Generate 60 test spans
 * const metrics = await measureRenderPerformance(testSpans, editorRef);
 * console.log(metrics);
 * ```
 */

import { TAXONOMY } from '@shared/taxonomy.js';

/**
 * Generate test spans for performance testing
 * 
 * @param {number} count - Number of spans to generate (default: 50)
 * @param {string} sourceText - Source text to use (optional)
 * @returns {Array} Array of test spans
 */
export function generateTestSpans(count = 50, sourceText = null) {
  const text = sourceText || generateTestText(count);
  const spans = [];
  
  const categories = Object.values(TAXONOMY).map(cat => cat.id);
  const attributes = Object.values(TAXONOMY)
    .flatMap(cat => Object.values(cat.attributes || {}));
  
  const allCategories = [...categories, ...attributes];
  
  let offset = 0;
  
  for (let i = 0; i < count; i++) {
    const words = ['cinematic', 'shot', 'lighting', 'dramatic', 'camera', 'panning', 
                   'subject', 'environment', 'golden', 'hour', 'movement', 'tracking',
                   'close-up', 'wide', 'angle', 'lens', 'soft', 'diffused', 'vibrant',
                   'atmosphere', '24fps', '16:9', 'aesthetic', 'style', 'technical'];
    
    const word = words[i % words.length];
    const start = text.indexOf(word, offset);
    
    if (start === -1) continue;
    
    const end = start + word.length;
    offset = end;
    
    spans.push({
      id: `test-span-${i}`,
      text: word,
      quote: word,
      start,
      end,
      category: allCategories[i % allCategories.length],
      role: allCategories[i % allCategories.length],
      confidence: 0.7 + (Math.random() * 0.3), // 0.7 - 1.0
      source: 'llm',
      validatorPass: true,
    });
  }
  
  return spans;
}

/**
 * Generate test text with common video prompt terms
 */
function generateTestText(spanCount) {
  const sentences = [
    'cinematic shot of a dramatic scene with soft lighting and golden hour atmosphere.',
    'camera panning across the environment with tracking movement and close-up detail.',
    'wide angle lens captures the vibrant aesthetic with 24fps technical quality at 16:9.',
    'subject moves through the space with dynamic framing and style composition.',
    'diffused light creates mood while maintaining visual clarity throughout the sequence.',
  ];
  
  const repeatCount = Math.ceil(spanCount / 10);
  return sentences.join(' ').repeat(repeatCount);
}

/**
 * Measure rendering performance metrics
 * 
 * @param {Array} spans - Spans to render
 * @param {Object} editorRef - Reference to editor element
 * @returns {Promise<Object>} Performance metrics
 */
export async function measureRenderPerformance(spans, editorRef) {
  if (!editorRef?.current) {
    throw new Error('Invalid editor reference');
  }
  
  const metrics = {
    spanCount: spans.length,
    startTime: null,
    endTime: null,
    duration: null,
    fps: null,
    domNodeCount: null,
  };
  
  // Measure rendering time
  metrics.startTime = performance.now();
  
  // Trigger a re-render by updating some state
  // (This would be called by the consuming component)
  
  // Use requestAnimationFrame to measure when rendering completes
  await new Promise(resolve => {
    requestAnimationFrame(() => {
      metrics.endTime = performance.now();
      metrics.duration = metrics.endTime - metrics.startTime;
      
      // Count DOM nodes created
      const highlightElements = editorRef.current.querySelectorAll('[data-category]');
      metrics.domNodeCount = highlightElements.length;
      
      // Calculate approximate FPS (assuming 60fps baseline)
      const targetFrameTime = 16.67; // 60 fps
      metrics.fps = targetFrameTime / (metrics.duration / metrics.spanCount);
      
      resolve();
    });
  });
  
  return metrics;
}

/**
 * Compare performance before and after optimizations
 * 
 * @param {Function} renderFn - Function that triggers rendering
 * @param {Array} spans - Spans to render
 * @param {number} iterations - Number of times to repeat test
 * @returns {Object} Comparison metrics
 */
export async function comparePerformance(renderFn, spans, iterations = 5) {
  const results = [];
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await renderFn(spans);
    const end = performance.now();
    
    results.push(end - start);
  }
  
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const min = Math.min(...results);
  const max = Math.max(...results);
  
  return {
    iterations,
    spanCount: spans.length,
    times: results,
    average: avg,
    min,
    max,
    median: results.sort()[Math.floor(results.length / 2)],
  };
}

/**
 * Log performance metrics to console with formatting
 */
export function logPerformanceMetrics(metrics, label = 'Performance Test') {
  console.group(`📊 ${label}`);
  console.log(`Spans: ${metrics.spanCount}`);
  console.log(`Duration: ${metrics.duration?.toFixed(2)}ms`);
  console.log(`DOM Nodes: ${metrics.domNodeCount}`);
  console.log(`Avg FPS: ${metrics.fps?.toFixed(2)}`);
  
  if (metrics.times) {
    console.log(`Iterations: ${metrics.iterations}`);
    console.log(`Average: ${metrics.average.toFixed(2)}ms`);
    console.log(`Min: ${metrics.min.toFixed(2)}ms`);
    console.log(`Max: ${metrics.max.toFixed(2)}ms`);
    console.log(`Median: ${metrics.median.toFixed(2)}ms`);
  }
  
  console.groupEnd();
}

/**
 * Test diff-based rendering by making incremental changes
 * 
 * @param {Array} initialSpans - Initial span set
 * @param {Function} renderFn - Function to trigger rendering
 * @returns {Object} Test results
 */
export async function testIncrementalUpdates(initialSpans, renderFn) {
  const results = {
    initial: null,
    addOne: null,
    removeOne: null,
    updateOne: null,
  };
  
  // Initial render
  const t1 = performance.now();
  await renderFn(initialSpans);
  results.initial = performance.now() - t1;
  
  // Add one span
  const withAdded = [...initialSpans, generateTestSpans(1)[0]];
  const t2 = performance.now();
  await renderFn(withAdded);
  results.addOne = performance.now() - t2;
  
  // Remove one span
  const withRemoved = initialSpans.slice(0, -1);
  const t3 = performance.now();
  await renderFn(withRemoved);
  results.removeOne = performance.now() - t3;
  
  // Update one span
  const withUpdated = [...initialSpans];
  withUpdated[0] = { ...withUpdated[0], confidence: 0.95 };
  const t4 = performance.now();
  await renderFn(withUpdated);
  results.updateOne = performance.now() - t4;
  
  return results;
}

