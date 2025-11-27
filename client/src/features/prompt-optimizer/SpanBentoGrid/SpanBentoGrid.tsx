import { memo, useCallback } from 'react';
import type { RefObject } from 'react';
import { useSpanGrouping } from './hooks/useSpanGrouping';
import { BentoBox } from './components/BentoBox';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from './config/bentoConfig';
import { scrollToSpan } from './utils/spanFormatting';
import type { Span } from './components/types';

export interface SpanBentoGridProps {
  spans: Span[];
  onSpanClick?: (span: Span) => void;
  editorRef: RefObject<HTMLElement>;
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
  onSpanClick,
  editorRef,
}) => {
  const { groups } = useSpanGrouping(spans);
  
  // Memoize click handler to prevent BentoBox re-renders
  const handleSpanClick = useCallback((span: Span): void => {
    // 1. Scroll to span in editor with pulse animation
    scrollToSpan(editorRef, span);
    
    // 2. Trigger suggestions panel
    onSpanClick?.(span);
  }, [editorRef, onSpanClick]);
  
  return (
    <>
      {/* GEIST HEADER: White background, border bottom, padding 4 (16pt) */}
      <div className="flex-shrink-0 px-geist-4 py-geist-3 bg-geist-background border-b border-geist-accents-2 flex items-center justify-between">
        <h3 className="text-label-12 font-semibold uppercase tracking-wider text-geist-accents-5">
          Analysis
        </h3>
        <span className="text-label-12 text-geist-accents-4 font-mono">
          {spans.length} SPANS
        </span>
      </div>

      {/* SCROLL AREA: Custom scrollbar styling via Tailwind utilities */}
      <div 
        className="flex-1 overflow-y-auto p-5 space-y-5 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-track]:bg-base-200 hover:[&::-webkit-scrollbar-thumb]:bg-base-300"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.scrollbarColor = 'hsl(var(--bc) / 0.2) transparent';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.scrollbarColor = 'transparent transparent';
        }}
      >
        {CATEGORY_ORDER.map(category => {
          const config = CATEGORY_CONFIG[category];
          if (!config) return null;
          
          return (
            <BentoBox
              key={category}
              category={category}
              spans={groups[category] || []}
              config={config}
              onSpanClick={handleSpanClick}
            />
          );
        })}
      </div>
    </>
  );
});

SpanBentoGrid.displayName = 'SpanBentoGrid';

