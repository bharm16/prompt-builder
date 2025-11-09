/**
 * Navigation Helper Utilities
 * 
 * Provides utility functions for wizard navigation.
 */

import { STEP_REQUIREMENTS } from '../config/stepConfig';
import { MOBILE_FIELDS } from '../config/fieldConfig';

/**
 * Check if a field is valid
 */
export function isFieldValid(fieldName, value, isRequired) {
  if (!isRequired) {
    return true;
  }
  return value && value.trim().length > 0;
}

/**
 * Validate current mobile field
 */
export function validateMobileField(fieldIndex, formData) {
  const currentField = MOBILE_FIELDS[fieldIndex];
  const currentValue = formData[currentField.name];

  if (currentField.required) {
    return currentValue && currentValue.trim().length > 0;
  }
  return true; // Optional fields are always valid
}

/**
 * Check if can navigate to next mobile field
 */
export function canNavigateNext(fieldIndex, formData) {
  const currentField = MOBILE_FIELDS[fieldIndex];
  return !currentField.required || validateMobileField(fieldIndex, formData);
}

/**
 * Get next step based on current step
 */
export function getNextStep(currentStep, maxSteps) {
  return Math.min(currentStep + 1, maxSteps - 1);
}

/**
 * Get previous step based on current step
 */
export function getPreviousStep(currentStep) {
  return Math.max(currentStep - 1, 0);
}

