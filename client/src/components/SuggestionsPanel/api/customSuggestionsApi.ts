/**
 * Re-export facade — implementation owned by prompt-optimizer feature.
 * This shim keeps SuggestionsPanel internal imports working during migration.
 */
export {
  customSuggestionsApi,
  fetchCustomSuggestions,
} from "@features/prompt-optimizer/api/customSuggestionsApi";
