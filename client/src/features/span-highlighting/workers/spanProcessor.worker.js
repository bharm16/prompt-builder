/**
 * Span Processing Web Worker
 * 
 * Moves heavy span processing operations off the main thread to keep UI responsive.
 * Handles validation, sorting, overlap detection, and filtering in a background thread.
 * 
 * PERFORMANCE BENEFIT:
 * - Keeps main thread free for rendering and user interactions
 * - Particularly beneficial with 50+ spans
 * - Non-blocking operation for expensive computations
 * 
 * MESSAGE FORMAT:
 * Input: { type: 'process', spans: Array, text: string, options: Object }
 * Output: { type: 'result', processedSpans: Array, meta: Object }
 *        or { type: 'error', error: string }
 */

// Simple validation function (mirrors frontend categoryValidators.js but simplified)
function validateSpanStructure(span) {
  if (!span) return false;
  
  const text = (span.text || span.quote || '').trim();
  if (!text) return false;
  
  // Basic structure checks
  if (typeof span.start !== 'number' || typeof span.end !== 'number') return false;
  if (span.start < 0 || span.end <= span.start) return false;
  
  return true;
}

// Check for overlap between two spans
function spansOverlap(span1, span2) {
  return !(span1.end <= span2.start || span2.end <= span1.start);
}

// Sort spans by position
function sortSpans(spans) {
  return [...spans].sort((a, b) => {
    if (a.start === b.start) {
      return a.end - b.end;
    }
    return a.start - b.start;
  });
}

// Remove overlapping spans (keep higher confidence)
function removeOverlaps(spans) {
  if (spans.length === 0) return [];
  
  const sorted = sortSpans(spans);
  const result = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = result[result.length - 1];
    
    if (!spansOverlap(current, last)) {
      result.push(current);
    } else {
      // Keep the one with higher confidence
      const currentConf = current.confidence || 0;
      const lastConf = last.confidence || 0;
      
      if (currentConf > lastConf) {
        result[result.length - 1] = current;
      }
    }
  }
  
  return result;
}

// Filter by confidence threshold
function filterByConfidence(spans, minConfidence = 0) {
  if (minConfidence <= 0) return spans;
  
  return spans.filter(span => {
    const confidence = span.confidence || 0;
    return confidence >= minConfidence;
  });
}

// Deduplicate spans (same text, position, category)
function deduplicateSpans(spans) {
  const seen = new Set();
  const result = [];
  
  for (const span of spans) {
    const key = `${span.start}-${span.end}-${span.category || span.role}-${span.text || span.quote}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      result.push(span);
    }
  }
  
  return result;
}

// Main processing pipeline
function processSpans(spans, text, options = {}) {
  const {
    minConfidence = 0,
    maxSpans = 100,
    removeOverlaps: shouldRemoveOverlaps = true,
    deduplicate = true,
  } = options;
  
  // Step 1: Validate structure
  let processed = spans.filter(validateSpanStructure);
  
  // Step 2: Deduplicate
  if (deduplicate) {
    processed = deduplicateSpans(processed);
  }
  
  // Step 3: Filter by confidence
  processed = filterByConfidence(processed, minConfidence);
  
  // Step 4: Sort by position
  processed = sortSpans(processed);
  
  // Step 5: Remove overlaps
  if (shouldRemoveOverlaps) {
    processed = removeOverlaps(processed);
  }
  
  // Step 6: Truncate to maxSpans
  if (maxSpans > 0 && processed.length > maxSpans) {
    processed = processed.slice(0, maxSpans);
  }
  
  return processed;
}

// Worker message handler
self.onmessage = function (e) {
  const { id, type, spans, text, options } = e.data;
  
  try {
    if (type === 'process') {
      const startTime = performance.now();
      
      const processedSpans = processSpans(spans, text, options);
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      self.postMessage({
        id, // Include ID for callback tracking
        type: 'result',
        processedSpans,
        meta: {
          originalCount: spans.length,
          processedCount: processedSpans.length,
          processingTime,
        },
      });
    } else {
      self.postMessage({
        id, // Include ID even for errors
        type: 'error',
        error: `Unknown message type: ${type}`,
      });
    }
  } catch (error) {
    self.postMessage({
      id, // Include ID for error handling
      type: 'error',
      error: error.message || 'Unknown error in worker',
    });
  }
};

// Signal that worker is ready
self.postMessage({ type: 'ready' });

