/**
 * BentoInput - Input field for expanded bento box
 * 
 * Integrates:
 * - Floating label input field
 * - Field description
 * - Inline AI suggestions
 * 
 * @module BentoInput
 */

import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import InlineSuggestions from '../../InlineSuggestions';
import { wizardTheme } from '../../../../styles/wizardTheme';

/**
 * BentoInput component
 */
export function BentoInput({
  field,
  value,
  onChange,
  onFocus,
  suggestions,
  isLoadingSuggestions,
  onSuggestionSelect,
  registerInputRef,
  accentColor,
}) {
  const inputRef = useRef(null);

  useEffect(() => {
    // Register the input ref for auto-focus
    if (inputRef.current) {
      registerInputRef(field.id, inputRef.current);
    }
    return () => registerInputRef(field.id, null);
  }, [field.id, registerInputRef]);

  const isTextarea = field.inputType === 'textarea';

  const inputStyles = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: wizardTheme.fontFamily.primary,
    color: wizardTheme.colors.neutral[900],
    backgroundColor: wizardTheme.colors.background.card,
    border: `2px solid ${accentColor}`,
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: `0 0 0 3px ${accentColor}20`,
    resize: isTextarea ? 'vertical' : 'none',
    minHeight: isTextarea ? '80px' : 'auto',
    lineHeight: '1.5',
  };

  return (
    <div className="bento-input relative">
      {/* Description */}
      {field.description && (
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '13px',
            color: wizardTheme.colors.neutral[600],
            lineHeight: 1.4,
          }}
        >
          {field.description}
        </p>
      )}

      {/* Input field or Textarea */}
      {isTextarea ? (
        <textarea
          ref={inputRef}
          value={value || ''}
          onChange={onChange}
          onFocus={onFocus}
          placeholder={field.placeholder}
          rows={3}
          style={inputStyles}
        />
      ) : (
        <input
          ref={inputRef}
          type="text"
          value={value || ''}
          onChange={onChange}
          onFocus={onFocus}
          placeholder={field.placeholder}
          style={inputStyles}
        />
      )}

      {/* Suggestions Dropdown */}
      <InlineSuggestions
        suggestions={suggestions || []}
        isLoading={Boolean(isLoadingSuggestions)}
        onSelect={(text) => onSuggestionSelect(field.id, text)}
        fieldName={field.id}
      />
    </div>
  );
}

BentoInput.propTypes = {
  field: PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string,
    placeholder: PropTypes.string,
  }).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onFocus: PropTypes.func.isRequired,
  suggestions: PropTypes.array,
  isLoadingSuggestions: PropTypes.bool,
  onSuggestionSelect: PropTypes.func.isRequired,
  registerInputRef: PropTypes.func.isRequired,
  accentColor: PropTypes.string.isRequired,
};

export default BentoInput;

