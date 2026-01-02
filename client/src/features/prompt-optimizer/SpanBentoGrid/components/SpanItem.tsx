import { memo } from 'react';
import type { SpanItemProps } from './types';

/**
 * Individual span display with confidence badge
 * Clickable button that triggers scroll-to-highlight and suggestions
 */
export const SpanItem = memo<SpanItemProps>(({ span, onClick, backgroundColor, borderColor, isSelected = false }) => {
  const handleClick = (): void => {
    onClick?.(span);
  };
  
  // Use category colors if provided, otherwise fallback to Geist colors
  const bgColor = backgroundColor || '#ffffff';
  const brdColor = borderColor || '#eaeaea';
  
  return (
    <button
      className={`w-full px-2 py-1.5 rounded-geist border hover:shadow-geist-small active:scale-[0.99] transition-all duration-150 flex items-center text-left text-xs text-geist-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-geist-accents-5 ${
        isSelected ? 'span-item--selected' : ''
      }`}
      style={{
        backgroundColor: bgColor,
        borderColor: brdColor,
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid',
        opacity: isSelected ? 1 : undefined,
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.opacity = '0.9';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.opacity = '1';
        }
      }}
      onClick={handleClick}
      type="button"
      title={`Click to view in context (${span.start}-${span.end})`}
      aria-pressed={isSelected}
    >
      <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left">
        {span.quote}
      </span>
    </button>
  );
});

SpanItem.displayName = 'SpanItem';

