/**
 * usePromptHistory - Prompt History Management Hook
 *
 * Refactored to follow SRP/SOC principles:
 * - usePromptHistory.ts: Orchestrator (coordination only)
 * - hooks/useHistoryState.ts: State management
 * - api/historyRepository.ts: Repository operations
 * - types.ts: Type definitions
 */

export { usePromptHistory } from './usePromptHistory';
export type { User, PromptHistoryEntry, Toast, HistoryState, SaveEntryParams, SaveResult } from './types';
