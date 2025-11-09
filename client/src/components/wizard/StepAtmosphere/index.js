/**
 * StepAtmosphere Module
 *
 * A refactored, well-architected component for the atmosphere step of the wizard.
 *
 * BEFORE: 494 lines of tightly coupled code
 * AFTER: ~200 line orchestration component + modular architecture
 *
 * Architecture:
 * - Main component: StepAtmosphere.jsx (orchestration)
 * - State management: hooks/useAtmosphereForm.js (form logic)
 * - Responsive layout: hooks/useResponsiveLayout.js (breakpoint detection)
 * - Configuration: config/fieldConfig.js (field definitions)
 * - UI components: components/*.jsx (reusable pieces)
 */

export { default } from './StepAtmosphere';

// Export hooks for advanced usage
export { useAtmosphereForm } from './hooks/useAtmosphereForm';
export { useResponsiveLayout } from './hooks/useResponsiveLayout';

// Export configuration
export { ATMOSPHERE_FIELDS, FIELD_ORDER, hasAnyAtmosphereData } from './config/fieldConfig';

