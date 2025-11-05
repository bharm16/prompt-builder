/**
 * WizardVideoBuilder Step Configuration
 * 
 * Defines the desktop step labels and navigation.
 */

// Desktop step labels (with QuickFill as step 0)
export const STEP_LABELS = ['Quick Fill', 'Core Concept', 'Atmosphere', 'Review'];

// Step validation requirements
export const STEP_REQUIREMENTS = {
  0: [], // Quick Fill - no requirements
  1: ['subject', 'action', 'location'], // Core Concept - required fields
  2: [], // Atmosphere - all optional
  3: [], // Review - no new requirements
};

