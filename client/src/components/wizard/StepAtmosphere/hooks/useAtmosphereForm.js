/**
 * useAtmosphereForm - Form state and handlers for atmosphere fields
 *
 * Manages:
 * - Active field tracking
 * - Field change handlers
 * - Suggestion request handlers
 * - Keyboard navigation (Enter to move to next field)
 *
 * @module useAtmosphereForm
 */

import { useState, useCallback } from 'react';
import { FIELD_ORDER } from '../config/fieldConfig';

/**
 * Custom hook for atmosphere form logic
 * @param {Object} formData - Current form data
 * @param {Function} onChange - Field change handler from parent
 * @param {Function} onRequestSuggestions - Suggestion request handler from parent
 * @param {Function} onNext - Navigate to next step handler
 * @returns {Object} Form state and handlers
 */
export function useAtmosphereForm({ formData, onChange, onRequestSuggestions, onNext }) {
  const [activeField, setActiveField] = useState(null);

  // Request suggestions when field gains focus
  const handleFocus = useCallback(
    (fieldName) => {
      setActiveField(fieldName);
      const value = formData[fieldName] || '';
      onRequestSuggestions(fieldName, value);
    },
    [formData, onRequestSuggestions]
  );

  // Handle field change
  const handleChange = useCallback(
    (fieldName, value) => {
      onChange(fieldName, value);
      // Request new suggestions on change
      if (value.length > 0) {
        onRequestSuggestions(fieldName, value);
      }
    },
    [onChange, onRequestSuggestions]
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestionText) => {
      if (activeField) {
        onChange(activeField, suggestionText);
      }
    },
    [activeField, onChange]
  );

  // Handle Enter key to move to next field or submit
  const handleKeyDown = useCallback(
    (e, fieldName) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const currentIndex = FIELD_ORDER.indexOf(fieldName);
        if (currentIndex < FIELD_ORDER.length - 1) {
          // Move to next field
          const nextField = FIELD_ORDER[currentIndex + 1];
          document.getElementById(`${nextField}-input`)?.focus();
        } else {
          // Last field - move to next step
          onNext();
        }
      }
    },
    [onNext]
  );

  return {
    activeField,
    handleFocus,
    handleChange,
    handleSuggestionSelect,
    handleKeyDown,
  };
}

