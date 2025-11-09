import { memo } from 'react';

/**
 * Individual span display with confidence badge
 * Clickable button that triggers scroll-to-highlight and suggestions
 * 
 * @param {Object} span - Span object with quote, confidence, start, end, id
 * @param {Function} onClick - Handler for span click
 */
export const SpanItem = memo(({ span, onClick }) => {
  const handleClick = () => {
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
      {span.confidence && (
        <span className="confidence-badge">
          {Math.round(span.confidence * 100)}%
        </span>
      )}
    </button>
  );
});

SpanItem.displayName = 'SpanItem';

