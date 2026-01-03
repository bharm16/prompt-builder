import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SpanItem } from './SpanItem';
import { EMPTY_STATE_MESSAGE } from '../config/bentoConfig';
import type { BentoBoxProps } from './types';

/**
 * Maps category order to card size
 * Categories are distributed across xs, sm, md, lg, xl sizes
 */
const getCardSize = (order: number): 'card-xs' | 'card-sm' | 'card-md' | 'card-lg' | 'card-xl' => {
  if (order <= 2) return 'card-xs';
  if (order <= 4) return 'card-sm';
  if (order <= 6) return 'card-md';
  if (order <= 8) return 'card-lg';
  return 'card-xl';
};

/**
 * Category container with collapse/expand functionality using DaisyUI cards
 * Shows "No items" when empty for consistent layout
 * Smart default: Expanded only if category has 3+ spans, collapsed otherwise
 * This reduces visual clutter and helps users focus on what matters
 */
export const BentoBox = memo<BentoBoxProps>(({ 
  category, 
  spans, 
  config, 
  onSpanClick,
  selectedSpanId,
}) => {
  // Expand by default only if category has meaningful content (3+ spans)
  // Empty or low-count categories start collapsed to reduce clutter
  const [isExpanded, setIsExpanded] = useState<boolean>(spans.length >= 3);
  
  const hasSpans = spans.length > 0;
  const IconComponent = config.icon;
  const cardSize = getCardSize(config.order);
  
  return (
    <div 
      className={`card w-full rounded-geist-lg shadow-geist-small hover:shadow-geist-medium transition-all duration-200 ${cardSize} flex flex-col min-h-[150px] ${isExpanded ? 'max-h-[500px]' : 'max-h-[250px]'}`}
      style={{
        backgroundColor: config.backgroundColor,
        borderColor: config.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
      onMouseEnter={(e) => {
        // Darken border on hover for better visual feedback
        const currentBorder = config.borderColor;
        e.currentTarget.style.borderColor = currentBorder;
        e.currentTarget.style.opacity = '0.95';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
    >
      {/* HEADER: Title with icon and count - at the very top */}
      <div 
        className="flex items-center justify-start gap-1.5 px-2 py-2 cursor-pointer hover:bg-geist-accents-1 transition-all duration-150 flex-shrink-0"
        onClick={() => setIsExpanded(!isExpanded)}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${config.label} category`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        <IconComponent size={12} className="flex-shrink-0" />
        <span className="text-xs font-medium text-left truncate">
          {config.label}
        </span>
        <span className="text-xs text-geist-accents-4 font-mono flex-shrink-0">
          {spans.length}
        </span>
        {isExpanded ? (
          <ChevronDown size={12} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="flex-shrink-0" />
        )}
      </div>
      
      <div className="card-body flex-1 flex flex-col min-h-0 overflow-hidden pt-1 pb-2 px-2">
        {/* CONTENT: Spans list - always scrollable */}
        {hasSpans ? (
          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 w-full scrollbar-hide">
            {spans.map(span => (
              <SpanItem 
                key={span.id} 
                span={span} 
                onClick={onSpanClick}
                backgroundColor={config.backgroundColor}
                borderColor={config.borderColor}
                isSelected={selectedSpanId === span.id}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-geist-accents-3 italic">
            {EMPTY_STATE_MESSAGE}
          </div>
        )}
      </div>
    </div>
  );
});

BentoBox.displayName = 'BentoBox';

