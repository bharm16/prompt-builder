/**
 * useBentoExpansion - Manages bento box expansion state
 * 
 * Ensures only one bento box is expanded at a time
 * Handles expand/collapse/switch logic
 * Manages focus state for inputs
 * 
 * @module useBentoExpansion
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for managing bento box expansion
 * @returns {Object} Expansion state and handlers
 */
export function useBentoExpansion() {
  const [expandedField, setExpandedField] = useState(null);
  const inputRefs = useRef({});

  /**
   * Expand a field (and collapse any currently expanded field)
   * @param {string} fieldId - Field to expand
   */
  const handleExpand = useCallback((fieldId) => {
    setExpandedField(fieldId);
    
    // Focus the input after expansion animation completes
    setTimeout(() => {
      if (inputRefs.current[fieldId]) {
        inputRefs.current[fieldId].focus();
      }
    }, 300);
  }, []);

  /**
   * Collapse the currently expanded field
   */
  const handleCollapse = useCallback(() => {
    setExpandedField(null);
  }, []);

  /**
   * Toggle a field's expansion state
   * @param {string} fieldId - Field to toggle
   */
  const handleToggle = useCallback((fieldId) => {
    setExpandedField(current => current === fieldId ? null : fieldId);
    
    // Focus if expanding
    if (expandedField !== fieldId) {
      setTimeout(() => {
        if (inputRefs.current[fieldId]) {
          inputRefs.current[fieldId].focus();
        }
      }, 300);
    }
  }, [expandedField]);

  /**
   * Check if a field is expanded
   * @param {string} fieldId - Field to check
   * @returns {boolean}
   */
  const isExpanded = useCallback((fieldId) => {
    return expandedField === fieldId;
  }, [expandedField]);

  /**
   * Register an input ref for auto-focus
   * @param {string} fieldId - Field ID
   * @param {HTMLElement} element - Input element
   */
  const registerInputRef = useCallback((fieldId, element) => {
    if (element) {
      inputRefs.current[fieldId] = element;
    } else {
      delete inputRefs.current[fieldId];
    }
  }, []);

  // Handle Escape key to collapse
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && expandedField) {
        handleCollapse();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [expandedField, handleCollapse]);

  return {
    expandedField,
    handleExpand,
    handleCollapse,
    handleToggle,
    isExpanded,
    registerInputRef,
  };
}

