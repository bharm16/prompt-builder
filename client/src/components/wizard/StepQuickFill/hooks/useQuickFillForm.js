/**
 * useQuickFillForm - Form validation, progress, and handlers
 *
 * Manages Quick Fill form logic:
 * - Validation (subject and action required)
 * - Progress calculation (filled fields / total fields)
 * - Event handlers (field change, suggestion select, focus/blur)
 *
 * @module useQuickFillForm
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { TOTAL_FIELDS } from '../config/fieldConfig';

/**
 * Custom hook for Quick Fill form logic
 * @param {Object} formData - Form data from parent
 * @param {Function} onChange - Parent onChange callback
 * @param {Function} onRequestSuggestions - Parent suggestion request callback
 * @returns {Object} Form state and handlers
 */
export function useQuickFillForm(formData, onChange, onRequestSuggestions) {
  // Active field tracking for suggestions
  const [activeField, setActiveField] = useState(null);
  const suggestionsRef = useRef(null);

  // Validation (no minimum length required, just non-empty)
  const validation = useMemo(() => {
    const isSubjectValid = formData.subject && formData.subject.trim().length > 0;
    const isActionValid = formData.action && formData.action.trim().length > 0;
    const canContinue = isSubjectValid && isActionValid;

    return {
      isSubjectValid,
      isActionValid,
      canContinue,
    };
  }, [formData.subject, formData.action]);

  // Progress calculation
  const progress = useMemo(() => {
    const filledFields = Object.values(formData).filter(
      v => v && v.trim && v.trim().length > 0
    ).length;
    const completionPercentage = Math.round((filledFields / TOTAL_FIELDS) * 100);

    return {
      filledFields,
      totalFields: TOTAL_FIELDS,
      completionPercentage,
    };
  }, [formData]);

  // Event handlers
  const handleFieldChange = useCallback((field, value) => {
    onChange(field, value);
  }, [onChange]);

  const handleSuggestionSelect = useCallback((field, text) => {
    onChange(field, text);
  }, [onChange]);

  const handleFocus = useCallback((fieldName) => {
    setActiveField(fieldName);
    onRequestSuggestions(fieldName, formData[fieldName] || '');
  }, [onRequestSuggestions, formData]);

  const handleBlur = useCallback((e) => {
    if (!suggestionsRef.current?.contains(e.relatedTarget)) {
      setActiveField(null);
    }
  }, []);

  return {
    validation,
    progress,
    activeField,
    suggestionsRef,
    handlers: {
      handleFieldChange,
      handleSuggestionSelect,
      handleFocus,
      handleBlur,
    },
  };
}
