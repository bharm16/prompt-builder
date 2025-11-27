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
  const IconComponent = config.icon;
  
  return (
    // GEIST CARD: White bg, subtle shadow, rounded corners, transition
    <div 
      className={`
        group flex flex-col bg-geist-background 
        border border-geist-accents-2 rounded-geist-lg
        shadow-geist-small hover:shadow-geist-medium hover:border-geist-accents-3
        transition-all duration-200 ease-in-out
        ${isExpanded ? 'min-h-[120px]' : 'h-[40px]'}
      `}
      style={{
        borderColor: config.borderColor,
      }}
    >
      {/* HEADER: Clickable, flex, accent text colors */}
      <button
        className="flex items-center gap-geist-2 px-geist-3 py-geist-2 w-full text-left cursor-pointer hover:bg-geist-accents-1 transition-colors rounded-t-geist-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-geist-accents-5 min-w-0"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
        aria-expanded={isExpanded}
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${config.label} category`}
      >
        <IconComponent size={14} className="text-geist-accents-5 flex-shrink-0" />
        <span className="text-label-13 font-medium text-geist-foreground flex-1 min-w-0 truncate">
          {config.label}
        </span>
        <span className="text-label-12 text-geist-accents-4 font-mono flex-shrink-0">
          {spans.length}
        </span>
        {isExpanded ? (
          <ChevronDown size={14} className="text-geist-accents-3 flex-shrink-0" />
        ) : (
          <ChevronRight size={14} className="text-geist-accents-3 flex-shrink-0" />
        )}
      </button>
      
      {/* CONTENT: Animated expansion would go here, simplified for structure */}
      {isExpanded && (
        <div className="flex-1 p-geist-2 flex flex-col gap-geist-2 overflow-y-auto max-h-[200px] border-t border-geist-accents-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-track]:bg-geist-accents-1 hover:[&::-webkit-scrollbar-thumb]:bg-geist-accents-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.scrollbarColor = 'var(--geist-accents-3) var(--geist-accents-1)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.scrollbarColor = 'transparent transparent';
          }}
        >
          {hasSpans ? (
            spans.map(span => (
              <SpanItem 
                key={span.id} 
                span={span} 
                onClick={onSpanClick}
              />
            ))
          ) : (
            <div className="text-center py-geist-4 text-label-12 text-geist-accents-3 italic">
              {EMPTY_STATE_MESSAGE}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

BentoBox.displayName = 'BentoBox';

