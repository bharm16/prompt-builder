import { memo, useState } from 'react';
import { SpanItem } from './SpanItem';
import { EMPTY_STATE_MESSAGE } from '../config/bentoConfig';
import type { BentoBoxProps } from './types';

/**
 * Category section container with collapse/expand functionality.
 */
export const BentoBox = memo<BentoBoxProps>(({ 
  category, 
  spans, 
  config, 
  onSpanClick,
  defaultExpanded = false,
  onSpanHoverChange,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(defaultExpanded);

  const hasSpans = spans.length > 0;
  const IconComponent = config.icon;

  return (
    <section
      className="pc-outline-section"
      data-category={category}
      data-expanded={isExpanded ? 'true' : 'false'}
    >
      <button
        type="button"
        className="pc-outline-section__header"
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <IconComponent size={14} className="pc-outline-section__icon" />
        <span className="pc-outline-section__title">{config.label}</span>
        <span className="pc-outline-section__count" aria-label={`${spans.length} items`}>
          {spans.length}
        </span>
      </button>

      <div className={`pc-outline-section__body${isExpanded ? ' is-open' : ''}`}>
        <div className="pc-outline-section__body-inner">
          {hasSpans ? (
            <div className="pc-outline-token-list">
              {spans.map((span) => (
                <SpanItem
                  key={span.id}
                  span={span}
                  onClick={onSpanClick}
                  onHoverChange={onSpanHoverChange}
                  backgroundColor={config.backgroundColor}
                  borderColor={config.borderColor}
                />
              ))}
            </div>
          ) : (
            <div className="pc-outline-empty">{EMPTY_STATE_MESSAGE}</div>
          )}
        </div>
      </div>
    </section>
  );
});

BentoBox.displayName = 'BentoBox';
