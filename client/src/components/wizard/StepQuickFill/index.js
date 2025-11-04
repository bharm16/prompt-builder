/**
 * StepQuickFill Module Exports
 *
 * Clean barrel export for StepQuickFill and its reusable primitives.
 */

// Main component
export { StepQuickFill } from './StepQuickFill';

// Reusable primitive components (for use in other wizard steps)
export { FloatingTextField } from './components/FloatingTextField';
export { ProgressBadge } from './components/ProgressBadge';
export { SectionHeader } from './components/SectionHeader';
export { ModeToggle } from './components/ModeToggle';

// Hooks (for reuse in similar forms)
export { useQuickFillForm } from './hooks/useQuickFillForm';
export { useStaggeredAnimation } from './hooks/useStaggeredAnimation';

// Config (for customization)
export {
  FIELD_CONFIG,
  CORE_CONCEPT_FIELDS,
  ATMOSPHERE_FIELDS,
  SECTIONS,
  TOTAL_FIELDS,
} from './config/fieldConfig';
export { injectAnimations, ANIMATION_TIMING, ANIMATION_DURATION } from './config/animations';
