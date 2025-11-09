/**
 * AtmosphereField - Reusable field component for atmosphere inputs
 *
 * Displays:
 * - Label
 * - Description
 * - Text input with focus styling
 * - Inline suggestions when focused
 */

import React from 'react';
import PropTypes from 'prop-types';
import InlineSuggestions from '../../InlineSuggestions';

export function AtmosphereField({
  field,
  value,
  isActive,
  suggestions,
  isLoadingSuggestions,
  onFocus,
  onChange,
  onKeyDown,
  onSuggestionSelect,
}) {
  return (
    <div>
      <label htmlFor={`${field.name}-input`} className="block text-sm font-semibold text-gray-700 mb-2">
        {field.label}
      </label>
      <p className="text-sm text-gray-600 mb-3">
        {field.description}
      </p>
      <input
        id={`${field.name}-input`}
        type="text"
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        onFocus={() => onFocus(field.name)}
        onKeyDown={(e) => onKeyDown(e, field.name)}
        placeholder={field.placeholder}
        className={`
          w-full px-4 py-3 text-base border-2 rounded-lg
          transition-all duration-200
          ${
            isActive
              ? 'border-purple-500 bg-white focus:ring-4 focus:ring-purple-100'
              : 'border-gray-300 bg-white focus:border-purple-500 focus:ring-4 focus:ring-purple-100'
          }
          focus:outline-none
        `}
      />

      {/* Suggestions */}
      {isActive && (
        <InlineSuggestions
          suggestions={suggestions || []}
          isLoading={isLoadingSuggestions}
          onSelect={onSuggestionSelect}
          fieldName={field.name}
        />
      )}
    </div>
  );
}

AtmosphereField.propTypes = {
  field: PropTypes.shape({
    name: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    placeholder: PropTypes.string.isRequired,
    required: PropTypes.bool,
  }).isRequired,
  value: PropTypes.string.isRequired,
  isActive: PropTypes.bool.isRequired,
  suggestions: PropTypes.array,
  isLoadingSuggestions: PropTypes.bool,
  onFocus: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onSuggestionSelect: PropTypes.func.isRequired,
};

AtmosphereField.defaultProps = {
  suggestions: [],
  isLoadingSuggestions: false,
};

