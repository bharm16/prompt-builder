/**
 * BACKWARD COMPATIBILITY SHIM
 * 
 * This file has been refactored into a folder structure.
 * The original implementation has been split into:
 * - hooks/usePromptLoader.js
 * - hooks/useHighlightsPersistence.js
 * - hooks/useUndoRedo.js
 * - hooks/usePromptOptimization.js
 * - hooks/useImprovementFlow.js
 * - hooks/useConceptBrainstorm.js
 * - hooks/useEnhancementSuggestions.js
 * - PromptOptimizerContainer/PromptOptimizerContainer.jsx (main orchestrator)
 * 
 * This shim maintains backward compatibility with existing imports.
 */

export { default } from './PromptOptimizerContainer/PromptOptimizerContainer.jsx';
