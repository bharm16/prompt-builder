// Re-export from shared for a single source of truth. Consumers in this
// feature import from "./schemas" so the anti-corruption layer surface is
// preserved — only the underlying definitions live in shared.
export {
  AssetForGenerationSchema,
  AssetImageUploadResponseSchema,
  AssetListResponseSchema,
  AssetSchema,
  AssetSuggestionSchema,
  ResolvedPromptSchema,
  TriggerValidationSchema,
} from "@shared/schemas/asset.schemas";
