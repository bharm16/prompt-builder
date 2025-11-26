import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SpanItem } from './SpanItem';
import { EMPTY_STATE_MESSAGE } from '../config/bentoConfig';
import type { BentoBoxProps } from './types';

/**
 * Category container with collapse/expand functionality
 * Shows "No items" when empty for consistent layout
 * Smart default: Expanded only if category has 3+ spans, collapsed otherwise
 * This reduces visual clutter and helps users focus on what matters
 */
export const BentoBox = memo<BentoBoxProps>(({ 
  category, 
  spans, 
  config, 
  onSpanClick,
}) => {
  // Expand by default only if category has meaningful content (3+ spans)
  // Empty or low-count categories start collapsed to reduce clutter
  const [isExpanded, setIsExpanded] = useState<boolean>(spans.length >= 3);
  
  const hasSpans = spans.length > 0;
  
  return (
    <div 
      className={`bento-box ${isExpanded ? 'bento-box-expanded' : 'bento-box-collapsed'}`}
      style={{
        borderColor: config.borderColor,
      }}
    >
      <button
        className="bento-header"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${config.label} category`}
      >
        <config.icon className="category-icon" />
        <span className="category-label">{config.label}</span>
        <span className="span-count">({spans.length})</span>
        <span className="spacer" />
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 chevron" />
        ) : (
          <ChevronRight className="h-4 w-4 chevron" />
        )}
      </button>
      
      {isExpanded && (
        <div className="bento-content">
          {hasSpans ? (
            spans.map(span => (
              <SpanItem 
                key={span.id} 
                span={span} 
                onClick={onSpanClick}
              />
            ))
          ) : (
            <div className="empty-state">{EMPTY_STATE_MESSAGE}</div>
          )}
        </div>
      )}
    </div>
  );
});

BentoBox.displayName = 'BentoBox';

