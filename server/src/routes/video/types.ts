import type { CompatibilityService } from "@services/video-concept/services/validation/CompatibilityService";
import type { ConceptParsingService } from "@services/video-concept/services/analysis/ConceptParsingService";
import type { ConflictDetectionService } from "@services/video-concept/services/detection/ConflictDetectionService";
import type { PromptValidationService } from "@services/video-concept/services/validation/PromptValidationService";
import type { SceneCompletionService } from "@services/video-concept/services/analysis/SceneCompletionService";
import type { SceneVariationService } from "@services/video-concept/services/analysis/SceneVariationService";
import type { SuggestionGeneratorService } from "@services/video-concept/services/generation/SuggestionGeneratorService";

export interface VideoServices {
  suggestionGenerator: SuggestionGeneratorService;
  compatibility: CompatibilityService;
  conflictDetection: ConflictDetectionService;
  sceneCompletion: SceneCompletionService;
  promptValidation: PromptValidationService;
  sceneVariation: SceneVariationService;
  conceptParsing: ConceptParsingService;
}
