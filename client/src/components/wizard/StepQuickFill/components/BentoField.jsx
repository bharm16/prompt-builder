/**
 * BentoField - Individual bento box with expand/collapse
 * 
 * States:
 * - Collapsed: Shows icon, label, and value preview
 * - Expanded: Shows full input field with suggestions
 * 
 * Features:
 * - Smooth expand/collapse animations
 * - Check mark when filled
 * - Hover effects (desktop only)
 * - Large/small size variants
 * - Keyboard accessible
 * 
 * @module BentoField
 */

import React from 'react';
import PropTypes from 'prop-types';
import { Check, ChevronDown, X } from 'lucide-react';
import { wizardTheme } from '../../../../styles/wizardTheme';
import BentoInput from './BentoInput';
import './BentoField.css';

/**
 * BentoField component
 */
export function BentoField({
  field,
  config,
  value,
  isExpanded,
  onExpand,
  onCollapse,
  onChange,
  onFocus,
  suggestions,
  isLoadingSuggestions,
  onRequestSuggestions,
  onSuggestionSelect,
  registerInputRef,
  mounted,
}) {
  const hasValue = value && value.length > 0;
  const isRequired = field.required;
  const bentoConfig = config;

  // Truncate value for preview (max 30 chars)
  const previewValue = hasValue ? 
    (value.length > 30 ? value.substring(0, 30) + '...' : value) : 
    null;

  const handleBoxClick = () => {
    if (!isExpanded) {
      onExpand(field.id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleBoxClick();
    }
  };

  return (
    <div
      className={`bento-field bento-field--${bentoConfig.size} ${isExpanded ? 'bento-field--expanded' : ''}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'scale(1)' : 'scale(0.95)',
        transitionDelay: `${field.delay}ms`,
      }}
    >
      {!isExpanded ? (
        /* Collapsed State */
        <button
          type="button"
          className="bento-field__collapsed"
          onClick={handleBoxClick}
          onKeyDown={handleKeyDown}
          aria-expanded={false}
          aria-label={`${field.label}${isRequired ? ' (required)' : ' (optional)'}`}
          style={{
            borderColor: bentoConfig.borderColor,
            backgroundColor: bentoConfig.bgColor,
          }}
        >
          {/* Icon */}
          <div 
            className="bento-field__icon"
            style={{ color: bentoConfig.color }}
          >
            {bentoConfig.icon}
          </div>

          {/* Content */}
          <div className="bento-field__content">
            <div className="bento-field__header">
              <span className="bento-field__label">
                {field.label}
                {isRequired && (
                  <span 
                    className="bento-field__required"
                    style={{ color: bentoConfig.color }}
                  >
                    {' *'}
                  </span>
                )}
              </span>
              {hasValue && (
                <Check 
                  size={16} 
                  className="bento-field__check"
                  style={{ color: wizardTheme.colors.success.base }}
                />
              )}
            </div>
            
            {/* Preview or placeholder */}
            {hasValue ? (
              <p className="bento-field__preview">{previewValue}</p>
            ) : (
              <p className="bento-field__placeholder">
                {isRequired ? 'Tap to fill (required)' : 'Tap to fill (optional)'}
              </p>
            )}
          </div>

          {/* Expand indicator */}
          <ChevronDown 
            size={20} 
            className="bento-field__chevron"
            style={{ color: bentoConfig.color }}
          />
        </button>
      ) : (
        /* Expanded State */
        <div 
          className="bento-field__expanded"
          style={{
            borderColor: bentoConfig.color,
            backgroundColor: '#FFFFFF',
          }}
        >
          {/* Header with close button */}
          <div className="bento-field__expanded-header">
            <div className="bento-field__expanded-title">
              <span 
                className="bento-field__expanded-icon"
                style={{ color: bentoConfig.color }}
              >
                {bentoConfig.icon}
              </span>
              <span className="bento-field__expanded-label">
                {field.label}
                {isRequired && (
                  <span style={{ color: bentoConfig.color }}> *</span>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={onCollapse}
              className="bento-field__close"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Input area */}
          <BentoInput
            field={field}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            suggestions={suggestions}
            isLoadingSuggestions={isLoadingSuggestions}
            onSuggestionSelect={onSuggestionSelect}
            registerInputRef={registerInputRef}
            accentColor={bentoConfig.color}
          />
        </div>
      )}
    </div>
  );
}

BentoField.propTypes = {
  field: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    placeholder: PropTypes.string,
    required: PropTypes.bool,
    delay: PropTypes.number,
  }).isRequired,
  config: PropTypes.shape({
    size: PropTypes.oneOf(['large', 'small']).isRequired,
    icon: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
    borderColor: PropTypes.string.isRequired,
    bgColor: PropTypes.string.isRequired,
  }).isRequired,
  value: PropTypes.string,
  isExpanded: PropTypes.bool.isRequired,
  onExpand: PropTypes.func.isRequired,
  onCollapse: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  suggestions: PropTypes.array,
  isLoadingSuggestions: PropTypes.bool,
  onRequestSuggestions: PropTypes.func.isRequired,
  onSuggestionSelect: PropTypes.func.isRequired,
  registerInputRef: PropTypes.func.isRequired,
  mounted: PropTypes.bool,
};

export default BentoField;

