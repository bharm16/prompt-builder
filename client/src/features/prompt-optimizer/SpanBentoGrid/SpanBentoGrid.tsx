import { memo, useCallback } from 'react';
import type { RefObject } from 'react';
import { useSpanGrouping } from './hooks/useSpanGrouping';
import { BentoBox } from './components/BentoBox';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from './config/bentoConfig';
import { scrollToSpan } from './utils/spanFormatting';
import type { Span } from './components/types';
import { TAXONOMY } from '@shared/taxonomy';

export interface SpanBentoGridProps {
  spans: Span[];
  editorRef: RefObject<HTMLElement>;
  onSpanHoverChange?: (spanId: string | null) => void;
}

/**
 * Main orchestrator component for Span Bento Grid
 * Displays spans grouped by category in collapsible bento boxes
 * Replaces "Your Input" panel
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - All components (BentoBox, SpanItem) are memoized
 * - Only expanded categories render their contents
 * - Stable keys (span.id) prevent unnecessary re-renders
 * - useCallback ensures handler stability
 * 
 * Virtual scrolling is NOT needed with only 7 categories.
 * The current implementation is already optimal for this scale.
 * 
 * Desktop: Left sidebar (288px wide)
 * Mobile: Bottom drawer (40vh height)
 */
export const SpanBentoGrid = memo<SpanBentoGridProps>(({ 
  spans,
  editorRef,
  onSpanHoverChange,
}) => {
  const { groups } = useSpanGrouping(spans);
  const orderedCategories = CATEGORY_ORDER as Array<keyof typeof CATEGORY_CONFIG>;
  
  // Memoize click handler to prevent BentoBox re-renders
  const handleSpanClick = useCallback((span: Span): void => {
    // 1. Scroll to span in editor with pulse animation
    scrollToSpan(editorRef, span);
  }, [editorRef]);
  
  return (
    <>
      {/* SCROLL AREA: Custom scrollbar styling via Tailwind utilities */}
      <div 
        className="pc-outline-sections"
      >
        {orderedCategories.map((category) => {
          const config = CATEGORY_CONFIG[category];
          if (!config) return null;
          
          return (
            <BentoBox
              key={category}
              category={category}
              spans={groups[category] || []}
              config={config}
              onSpanClick={handleSpanClick}
              onSpanHoverChange={onSpanHoverChange}
              defaultExpanded={category === TAXONOMY.SHOT.id || category === TAXONOMY.SUBJECT.id}
            />
          );
        })}
      </div>
    </>
  );
});

SpanBentoGrid.displayName = 'SpanBentoGrid';
