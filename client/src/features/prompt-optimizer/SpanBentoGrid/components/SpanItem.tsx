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
      className="span-item"
      onClick={handleClick}
      type="button"
      title={`Click to view in context (${span.start}-${span.end})`}
    >
      <span className="span-text">{span.quote}</span>
    </button>
  );
});

SpanItem.displayName = 'SpanItem';

