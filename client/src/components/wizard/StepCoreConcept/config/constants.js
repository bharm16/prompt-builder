/**
 * Constants and Configuration
 *
 * Field configurations, validation rules, responsive breakpoints,
 * and other constants for StepCoreConcept component.
 *
 * @module constants
 */

/**
 * Field configuration for all form fields
 * Defines id, label, description, validation, and progressive unlock logic
 */
export const FIELD_CONFIG = {
  subject: {
    id: "subject-input",
    label: "Subject",
    description: "What's the main focus? (e.g., person, object, animal)",
    required: true,
    minLength: 3,
    showCharCount: true,
    autoFocus: true,
    unlockCondition: null, // Always unlocked
  },
  descriptor1: {
    id: "descriptor1-input",
    label: "Descriptor 1",
    description: "Physical appearance (e.g., muscular, sleek, colorful)",
    required: false,
    unlockCondition: "subject", // Unlocked when subject is valid
    disabledMessage: "Complete the Subject field to unlock",
  },
  descriptor2: {
    id: "descriptor2-input",
    label: "Descriptor 2",
    description: "Visual details (e.g., wearing a red jersey, with gleaming headlights)",
    required: false,
    unlockCondition: "subject",
    disabledMessage: "Complete the Subject field to unlock",
  },
  descriptor3: {
    id: "descriptor3-input",
    label: "Descriptor 3",
    description: "Physical state or condition (e.g., in mid-stride, covered in dust)",
    required: false,
    unlockCondition: "subject",
    disabledMessage: "Complete the Subject field to unlock",
  },
  action: {
    id: "action-input",
    label: "Action",
    description: "What's happening? (e.g., running through, transforming into, leaping over)",
    required: true,
    minLength: 3,
    showCharCount: true,
    unlockCondition: "subject",
    disabledMessage: "Complete the Subject field to unlock",
  },
};

/**
 * Validation rules
 */
export const MIN_LENGTHS = {
  subject: 3,
  action: 3,
};

/**
 * Responsive breakpoints (px)
 */
export const BREAKPOINTS = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

/**
 * Responsive padding configurations
 */
export const RESPONSIVE_PADDING = {
  container: {
    desktop: "48px 40px",  // Desktop: generous vertical, comfortable horizontal
    tablet: "40px 32px",   // Tablet: moderate vertical, moderate horizontal
    mobile: "32px 24px",   // Mobile: efficient vertical, compact horizontal
  },
  card: {
    desktop: "32px",  // Desktop: comfortable padding
    tablet: "28px",   // Tablet: moderate padding
    mobile: "24px",   // Mobile: efficient padding
  },
};

/**
 * Success banner message
 */
export const SUCCESS_MESSAGE = "Excellent! Your core concept is complete. Feel free to add descriptors for more detail.";

/**
 * Button configuration
 */
export const BUTTON_CONFIG = {
  nextButton: {
    label: "Continue to Atmosphere",
    ariaLabel: "Continue to Atmosphere",
  },
};
