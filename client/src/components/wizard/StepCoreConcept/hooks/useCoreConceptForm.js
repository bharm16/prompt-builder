/**
 * useCoreConceptForm - Form state and validation logic
 *
 * Manages form validation and event handlers for CoreConcept form.
 * Note: Form data is managed by parent wizard component, this hook
 * provides validation state and event handlers.
 *
 * @module useCoreConceptForm
 */

import { useCallback, useMemo } from "react";
import { validators } from "../utils/helpers";
import { MIN_LENGTHS } from "../config/constants";

/**
 * Custom hook for CoreConcept form logic
 * @param {Object} formData - Form data from parent
 * @param {string} formData.subject - Subject field value
 * @param {string} formData.descriptor1 - Descriptor 1 field value
 * @param {string} formData.descriptor2 - Descriptor 2 field value
 * @param {string} formData.descriptor3 - Descriptor 3 field value
 * @param {string} formData.action - Action field value
 * @param {Function} onChange - Parent onChange callback
 * @returns {Object} Validation state and event handlers
 */
export function useCoreConceptForm(formData, onChange) {
  // Validation states (derived from formData)
  const validation = useMemo(() => {
    const isSubjectValid = validators.minLength(formData.subject, MIN_LENGTHS.subject);
    const isActionValid = validators.minLength(formData.action, MIN_LENGTHS.action);
    const showSuccessBanner = isSubjectValid && isActionValid;

    return {
      isSubjectValid,
      isActionValid,
      showSuccessBanner,
    };
  }, [formData.subject, formData.action]);

  // Handle field changes
  const handleFieldChange = useCallback(
    (field, value) => {
      onChange?.(field, value);
    },
    [onChange]
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (field, text) => {
      onChange?.(field, text);
    },
    [onChange]
  );

  return {
    validation,
    handlers: {
      handleFieldChange,
      handleSuggestionSelect,
    },
  };
}
