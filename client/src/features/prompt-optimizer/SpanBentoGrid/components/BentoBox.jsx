import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SpanItem } from './SpanItem.jsx';
import { EMPTY_STATE_MESSAGE } from '../config/bentoConfig.js';

/**
 * Category container with collapse/expand functionality
 * Shows "No items" when empty for consistent layout
 * Expanded by default
 * 
 * @param {string} category - Category identifier (e.g., 'lighting', 'framing')
 * @param {Array} spans - Array of spans for this category
 * @param {Object} config - Category configuration (label, color, icon, etc.)
 * @param {Function} onSpanClick - Handler for span clicks
 */
export const BentoBox = memo(({ 
  category, 
  spans, 
  config, 
  onSpanClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(true); // Expanded by default
  
  const hasSpans = spans.length > 0;
  
  return (
    <div 
      className="bento-box"
      style={{
        backgroundColor: config.color,
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
        <span className="category-icon">{config.icon}</span>
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

