import { memo } from 'react';
import { useSpanGrouping } from './hooks/useSpanGrouping.js';
import { BentoBox } from './components/BentoBox.jsx';
import { CATEGORY_CONFIG, CATEGORY_ORDER } from './config/bentoConfig.js';
import { scrollToSpan } from './utils/spanFormatting.js';
import './SpanBentoGrid.css';

/**
 * Main orchestrator component for Span Bento Grid
 * Displays spans grouped by category in collapsible bento boxes
 * Replaces "Your Input" panel
 * 
 * Desktop: Left sidebar (288px wide)
 * Mobile: Bottom drawer (40vh height)
 * 
 * @param {Array} spans - Array of labeled spans from parseResult
 * @param {Function} onSpanClick - Handler to trigger suggestions panel
 * @param {Object} editorRef - Ref to editor DOM element for scrolling
 */
export const SpanBentoGrid = memo(({ 
  spans,
  onSpanClick,
  editorRef,
}) => {
  const { groups, totalSpans, categoryCount } = useSpanGrouping(spans);
  
  const handleSpanClick = (span) => {
    // 1. Scroll to span in editor with pulse animation
    scrollToSpan(editorRef, span);
    
    // 2. Trigger suggestions panel
    onSpanClick?.(span);
  };
  
  return (
    <div className="span-bento-grid">
      {/* Header with stats */}
      <div className="bento-grid-header">
        <h2 className="header-title">Detected Elements</h2>
        <div className="header-stats">
          <span className="stat-item">{totalSpans} highlights</span>
          <span className="stat-divider">•</span>
          <span className="stat-item">{categoryCount} categories</span>
        </div>
      </div>
      
      {/* Scrollable boxes container */}
      <div className="bento-boxes-container">
        {CATEGORY_ORDER.map(category => (
          <BentoBox
            key={category}
            category={category}
            spans={groups[category]}
            config={CATEGORY_CONFIG[category]}
            onSpanClick={handleSpanClick}
          />
        ))}
      </div>
    </div>
  );
});

SpanBentoGrid.displayName = 'SpanBentoGrid';

