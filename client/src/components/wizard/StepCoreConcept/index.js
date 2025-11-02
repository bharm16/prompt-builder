/**
 * StepCoreConcept Module Exports
 *
 * Clean barrel export for StepCoreConcept and its reusable primitives.
 */

// Main component
export { StepCoreConcept } from './StepCoreConcept';

// Reusable primitive components (for use in other wizard steps)
export { SuccessBanner } from './components/SuccessBanner';
export { PrimaryButton } from './components/PrimaryButton';
export { TextField } from './components/TextField';
export { SuggestionChip } from './components/SuggestionChip';
export { InlineSuggestions } from './components/InlineSuggestions';

// Design tokens (for consistent styling across app)
export { tokens, injectGlobalStyles } from './config/designTokens';

// Hooks (for reuse in similar forms)
export { useCoreConceptForm } from './hooks/useCoreConceptForm';
export { useResponsiveLayout } from './hooks/useResponsiveLayout';
