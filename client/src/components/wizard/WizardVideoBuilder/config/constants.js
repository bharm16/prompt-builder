/**
 * WizardVideoBuilder Constants
 * 
 * Centralized configuration values for the wizard.
 */

// LocalStorage Configuration
export const STORAGE_KEY = 'wizard_video_builder_draft';
export const AUTO_SAVE_DELAY = 2000; // 2 seconds
export const MAX_STORAGE_AGE = 24 * 60 * 60 * 1000; // 24 hours

// Responsive Breakpoints
export const BREAKPOINTS = {
  mobile: 768,   // < 768px
  tablet: 1024,  // 768px - 1023px
  desktop: 1024, // >= 1024px
};

// Step Configuration
export const TOTAL_STEPS = 4; // Quick Fill, Core Concept, Atmosphere, Review

// Initial Form Data
export const INITIAL_FORM_DATA = {
  // Step 1: Core Concept (required)
  subject: '',
  descriptors: '',
  action: '',
  location: '',
  // Step 2: Atmosphere (optional)
  time: '',
  mood: '',
  style: '',
  event: '',
  // Step 3: Technical (optional)
  camera: {},
  lighting: {},
  composition: {},
  motion: {},
  effects: {},
};

