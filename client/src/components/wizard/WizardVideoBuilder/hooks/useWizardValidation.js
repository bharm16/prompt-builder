/**
 * useWizardValidation Hook
 * 
 * Handles validation logic for wizard steps and fields.
 */

import { useCallback } from 'react';
import { STEP_REQUIREMENTS } from '../config/stepConfig';

/**
 * useWizardValidation Hook
 * 
 * @param {Object} formData - Current form data
 * @param {Function} setValidationErrors - Function to set validation errors
 * @param {Function} addCompletedStep - Function to mark a step as completed
 */
export function useWizardValidation(formData, setValidationErrors, addCompletedStep) {
  /**
   * Validate required fields for a step
   */
  const validateStep = useCallback((stepIndex) => {
    const requiredFields = STEP_REQUIREMENTS[stepIndex] || [];
    const errors = {};
    
    for (const fieldName of requiredFields) {
      if (!formData[fieldName] || formData[fieldName].trim() === '') {
        errors[fieldName] = 'This field is required';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }
    
    setValidationErrors({});
    addCompletedStep(stepIndex);
    return true;
  }, [formData, setValidationErrors, addCompletedStep]);

  /**
   * Check if a step is complete
   */
  const isStepComplete = useCallback((stepIndex) => {
    const requiredFields = STEP_REQUIREMENTS[stepIndex] || [];
    return requiredFields.every(fieldName => 
      formData[fieldName] && formData[fieldName].trim() !== ''
    );
  }, [formData]);

  /**
   * Validate required fields
   */
  const validateRequiredFields = useCallback(() => {
    const errors = {};
    const requiredCoreFields = ['subject', 'action', 'location'];
    
    for (const fieldName of requiredCoreFields) {
      if (!formData[fieldName] || formData[fieldName].trim() === '') {
        errors[fieldName] = 'This field is required';
      }
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return false;
    }
    
    return true;
  }, [formData, setValidationErrors]);

  return {
    validateStep,
    isStepComplete,
    validateRequiredFields,
  };
}

