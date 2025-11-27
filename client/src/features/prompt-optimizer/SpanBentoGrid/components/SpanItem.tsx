import { memo } from 'react';
import type { SpanItemProps } from './types';

/**
 * Individual span display with confidence badge
 * Clickable button that triggers scroll-to-highlight and suggestions
 */
export const SpanItem = memo<SpanItemProps>(({ span, onClick }) => {
  const handleClick = (): void => {
    onClick?.(span);
  };
  
  return (
    <button
      className="w-full px-2 py-1.5 rounded-md bg-base-100 border border-base-300 hover:bg-base-200 hover:border-base-400 active:scale-[0.99] transition-all duration-150 flex items-center text-left text-xs text-base-content focus:outline-none focus-visible:ring-2 focus-visible:ring-base-content"
      onClick={handleClick}
      type="button"
      title={`Click to view in context (${span.start}-${span.end})`}
    >
      <span className="w-full overflow-hidden text-ellipsis whitespace-nowrap text-left">
        {span.quote}
      </span>
    </button>
  );
});

SpanItem.displayName = 'SpanItem';

