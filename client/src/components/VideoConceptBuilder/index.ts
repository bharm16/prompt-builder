/**
 * Video Concept Builder Module
 *
 * A refactored, well-architected component for building AI video concepts.
 *
 * BEFORE: 1,924 lines of tightly coupled code
 * AFTER:  519-line orchestration component + modular architecture
 *
 * Architecture:
 * - Main component: VideoConceptBuilder.tsx (orchestration)
 * - State management: hooks/useVideoConceptState.ts (useReducer)
 * - API layer: api/videoConceptApi.ts (centralized fetching)
 * - Business logic: utils/*.ts (pure functions)
 * - Configuration: config/*.ts (data-driven)
 * - Custom hooks: hooks/*.ts (isolated concerns)
 * - UI components: components/*.tsx (reusable pieces)
 */

export { default } from '../VideoConceptBuilder';
