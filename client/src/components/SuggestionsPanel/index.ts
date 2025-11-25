/**
 * SuggestionsPanel Module
 *
 * A refactored, well-architected component for displaying AI-powered suggestions.
 *
 * BEFORE: 602 lines of tightly coupled code
 * AFTER:  ~180-line orchestration component + modular architecture
 *
 * Architecture:
 * - Main component: SuggestionsPanel.tsx (orchestration)
 * - State management: hooks/useSuggestionsState.ts (category logic)
 * - API layer: api/customSuggestionsApi.ts (centralized fetching)
 * - Business logic: utils/suggestionHelpers.ts (pure functions)
 * - Configuration: config/panelConfig.ts (data-driven)
 * - Custom hooks: hooks/*.ts (isolated concerns)
 * - UI components: components/*.tsx (reusable pieces)
 *
 * Following VideoConceptBuilder pattern: index.ts
 */

export { default } from './SuggestionsPanel';

// Export hooks for advanced usage
export { useSuggestionsState } from './hooks/useSuggestionsState';
export { useCustomRequest } from './hooks/useCustomRequest';

// Export API for direct usage
export { customSuggestionsApi, fetchCustomSuggestions } from './api/customSuggestionsApi';

// Export utilities
export * from './utils/suggestionHelpers';

// Export configuration
export * from './config/panelConfig';

// Export components for composition
export { PanelHeader } from './components/PanelHeader';
export { CategoryTabs } from './components/CategoryTabs';
export { CustomRequestForm } from './components/CustomRequestForm';
export { SuggestionsList } from './components/SuggestionsList';
export { LoadingState, EmptyState, InactiveState } from './components/PanelStates';

