export { default } from './SharedPrompt';
export { default as SharedPrompt } from './SharedPrompt';

// Re-export types
export type { PromptData, PromptMode, SharedPromptState } from './types';

// Re-export hook for advanced usage
export { useSharedPrompt } from './hooks/useSharedPrompt';

// Re-export utils
export { getModeLabel } from './utils/promptUtils';
