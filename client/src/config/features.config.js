/**
 * Feature Flags Configuration
 *
 * Centralized feature toggles for enabling/disabling features
 * Makes it easy to control feature rollouts and A/B testing
 */

const ENV = import.meta.env.MODE || 'development';
const IS_DEV = ENV === 'development';

export const FEATURES = {
  // Core Features
  PROMPT_OPTIMIZATION: true,
  PROMPT_HISTORY: true,
  PROMPT_SHARING: true,

  // Advanced Features
  VIDEO_CONCEPT_BUILDER: true,
  PROMPT_IMPROVEMENT_WIZARD: true,
  HIGHLIGHT_SUGGESTIONS: true,
  AUTO_HIGHLIGHT_PERSIST: true,

  // Enhancement Features
  UNDO_REDO: true,
  KEYBOARD_SHORTCUTS: true,
  SCENE_CHANGE_DETECTION: true,

  // User Features
  GOOGLE_AUTH: true,
  LOCAL_STORAGE_FALLBACK: true,

  // Debug Features
  DEBUG_PANEL: IS_DEV,
  VERBOSE_LOGGING: IS_DEV,

  // Experimental Features (controlled by env vars)
  AI_SUGGESTIONS_CACHING: import.meta.env.VITE_FEATURE_AI_CACHING !== 'false',
  CONTEXT_PERSISTENCE: import.meta.env.VITE_FEATURE_CONTEXT_PERSIST !== 'false',
};

/**
 * Check if a feature is enabled
 */
export const isFeatureEnabled = (featureName) => {
  return FEATURES[featureName] === true;
};

/**
 * Get all enabled features
 */
export const getEnabledFeatures = () => {
  return Object.entries(FEATURES)
    .filter(([_, enabled]) => enabled === true)
    .map(([name]) => name);
};

/**
 * Feature flag hook for React components
 */
export const useFeature = (featureName) => {
  return isFeatureEnabled(featureName);
};
