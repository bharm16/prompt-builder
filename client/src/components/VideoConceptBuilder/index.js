/**
 * Video Concept Builder Module
 *
 * A refactored, well-architected component for building AI video concepts.
 *
 * BEFORE: 1,924 lines of tightly coupled code
 * AFTER:  519-line orchestration component + modular architecture
 *
 * Architecture:
 * - Main component: VideoConceptBuilder.jsx (orchestration)
 * - State management: hooks/useVideoConceptState.js (useReducer)
 * - API layer: api/videoConceptApi.js (centralized fetching)
 * - Business logic: utils/*.js (pure functions)
 * - Configuration: config/*.js (data-driven)
 * - Custom hooks: hooks/*.js (isolated concerns)
 * - UI components: components/*.jsx (reusable pieces)
 */

export { default } from './VideoConceptBuilder';

// Export hooks for advanced usage
export { useVideoConceptState } from './hooks/useVideoConceptState';
export { useElementSuggestions } from './hooks/useElementSuggestions';
export { useConflictDetection } from './hooks/useConflictDetection';
export { useRefinements } from './hooks/useRefinements';
export { useTechnicalParams } from './hooks/useTechnicalParams';
export { useCompatibilityScores } from './hooks/useCompatibilityScores';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// Export API for direct usage
export { VideoConceptApi } from './api/videoConceptApi';

// Export utilities
export * from './utils/subjectDescriptors';
export * from './utils/validation';
export * from './utils/formatting';

// Export configuration
export { ELEMENT_CONFIG } from './config/elementConfig';
export { TEMPLATE_LIBRARY } from './config/templates';
export * from './config/constants';

// Export components for composition
export { ProgressHeader } from './components/ProgressHeader';
export { ConceptPreview } from './components/ConceptPreview';
export { ElementCard } from './components/ElementCard';
export { ConflictsAlert } from './components/ConflictsAlert';
export { RefinementSuggestions } from './components/RefinementSuggestions';
export { TechnicalBlueprint } from './components/TechnicalBlueprint';
export { VideoGuidancePanel } from './components/VideoGuidancePanel';
export { TemplateSelector } from './components/TemplateSelector';
