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
}) => {
  // Expand by default only if category has meaningful content (3+ spans)
  // Empty or low-count categories start collapsed to reduce clutter
  const [isExpanded, setIsExpanded] = useState<boolean>(spans.length >= 3);
  
  const hasSpans = spans.length > 0;
  const IconComponent = config.icon;
  const cardSize = getCardSize(config.order);
  
  return (
    <div className={`card w-full bg-base-100 ${cardSize} shadow-sm flex flex-col min-h-[120px] ${isExpanded ? 'max-h-[400px]' : 'max-h-[200px]'}`}>
      {/* HEADER: Title with icon and count - at the very top */}
      <div 
        className="flex items-center justify-start gap-1.5 px-2 py-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
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
        <span className="text-xs text-base-content/60 font-mono flex-shrink-0">
          {spans.length}
        </span>
        {isExpanded ? (
          <ChevronDown size={12} className="flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="flex-shrink-0" />
        )}
      </div>
      
      <div className="card-body flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* CONTENT: Spans list - always scrollable */}
        {hasSpans ? (
          <div className="flex flex-col gap-1.5 overflow-y-auto flex-1 w-full [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-track]:bg-base-200 hover:[&::-webkit-scrollbar-thumb]:bg-base-300"
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.scrollbarColor = 'hsl(var(--bc) / 0.2) transparent';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.scrollbarColor = 'transparent transparent';
            }}
          >
            {spans.map(span => (
              <SpanItem 
                key={span.id} 
                span={span} 
                onClick={onSpanClick}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-xs text-base-content/50 italic">
            {EMPTY_STATE_MESSAGE}
          </div>
        )}
      </div>
    </div>
  );
});

BentoBox.displayName = 'BentoBox';

