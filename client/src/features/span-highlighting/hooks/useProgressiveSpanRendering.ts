import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  Span,
  UseProgressiveSpanRenderingOptions,
  UseProgressiveSpanRenderingReturn,
} from './types';

// Re-export types for backward compatibility
export type {
  Span,
  UseProgressiveSpanRenderingOptions,
  UseProgressiveSpanRenderingReturn,
} from './types';

/**
 * Progressive span rendering for improved perceived performance
 *
 * Instead of showing all spans at once, this hook implements a progressive rendering
 * strategy that shows high-confidence spans immediately and gradually reveals lower
 * confidence spans.
 *
 * Strategy:
 * 1. Immediate: Show spans with confidence >= 0.8 (high confidence)
 * 2. +50ms: Show spans with confidence >= 0.6 (medium confidence)
 * 3. +100ms: Show remaining spans (low confidence)
 */
export function useProgressiveSpanRendering({
  spans = [],
  enabled = true,
  highConfidenceDelay = 0,
  mediumConfidenceDelay = 50,
  lowConfidenceDelay = 100,
  highConfidenceThreshold = 0.8,
  mediumConfidenceThreshold = 0.6,
}: UseProgressiveSpanRenderingOptions = {}): UseProgressiveSpanRenderingReturn {
  const [visibleSpans, setVisibleSpans] = useState<Span[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  // Clear any pending timeouts
  const clearTimeouts = useCallback((): void => {
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current = [];
  }, []);

  useEffect(() => {
    // If progressive rendering is disabled, show all spans immediately
    if (!enabled || spans.length === 0) {
      setVisibleSpans(spans);
      setIsRendering(false);
      setProgress(100);
      return;
    }

    // Clear any pending renders
    clearTimeouts();
    setIsRendering(true);
    setProgress(0);

    // Categorize spans by confidence level
    const highConfidenceSpans = spans.filter(
      span => (span.confidence ?? 0.7) >= highConfidenceThreshold
    );
    const mediumConfidenceSpans = spans.filter(
      span =>
        (span.confidence ?? 0.7) >= mediumConfidenceThreshold &&
        (span.confidence ?? 0.7) < highConfidenceThreshold
    );
    const lowConfidenceSpans = spans.filter(
      span => (span.confidence ?? 0.7) < mediumConfidenceThreshold
    );

    // Phase 1: Show high-confidence spans immediately
    setVisibleSpans(highConfidenceSpans);
    setProgress(highConfidenceSpans.length > 0 ? (highConfidenceSpans.length / spans.length) * 100 : 0);

    // Phase 2: Add medium-confidence spans after delay
    if (mediumConfidenceSpans.length > 0) {
      const timeout1 = setTimeout(() => {
        setVisibleSpans(prev => [...prev, ...mediumConfidenceSpans]);
        setProgress(((highConfidenceSpans.length + mediumConfidenceSpans.length) / spans.length) * 100);
      }, mediumConfidenceDelay);
      timeoutsRef.current.push(timeout1);
    }

    // Phase 3: Add low-confidence spans after longer delay
    if (lowConfidenceSpans.length > 0) {
      const timeout2 = setTimeout(() => {
        setVisibleSpans(prev => [...prev, ...lowConfidenceSpans]);
        setProgress(100);
        setIsRendering(false);
      }, lowConfidenceDelay);
      timeoutsRef.current.push(timeout2);
    } else if (mediumConfidenceSpans.length === 0) {
      // If only high-confidence spans exist, we're done
      setIsRendering(false);
      setProgress(100);
    } else {
      // Mark rendering complete after medium confidence spans are shown
      const timeout3 = setTimeout(() => {
        setIsRendering(false);
      }, mediumConfidenceDelay + 10);
      timeoutsRef.current.push(timeout3);
    }

    // Cleanup on unmount or when spans change
    return () => {
      clearTimeouts();
    };
  }, [
    spans,
    enabled,
    highConfidenceDelay,
    mediumConfidenceDelay,
    lowConfidenceDelay,
    highConfidenceThreshold,
    mediumConfidenceThreshold,
    clearTimeouts,
  ]);

  return {
    visibleSpans,
    isRendering,
    progress,
    stats: {
      total: spans.length,
      visible: visibleSpans.length,
      remaining: spans.length - visibleSpans.length,
    },
  };
}

/**
 * Sort spans by confidence (high to low) for optimal progressive rendering
 */
export function sortSpansByConfidence(spans: Span[]): Span[] {
  return [...spans].sort((a, b) => {
    const confA = a.confidence ?? 0.7;
    const confB = b.confidence ?? 0.7;
    return confB - confA; // Descending order
  });
}

