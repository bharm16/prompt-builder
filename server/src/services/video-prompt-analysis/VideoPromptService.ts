import { VideoPromptDetectionService } from './services/detection/VideoPromptDetectionService.js';
import { PhraseRoleAnalysisService } from './services/analysis/PhraseRoleAnalysisService.js';
import { ConstraintGenerationService } from './services/analysis/ConstraintGenerationService.js';
import { FallbackStrategyService } from './services/guidance/FallbackStrategyService.js';
import { CategoryGuidanceService } from './services/guidance/CategoryGuidanceService.js';
import { ModelDetectionService } from './services/detection/ModelDetectionService.js';
import { SectionDetectionService } from './services/detection/SectionDetectionService.js';
import { TaxonomyValidationService } from '../taxonomy-validation/TaxonomyValidationService.js';
import { countWords } from './utils/textHelpers.js';
import type { ConstraintConfig, ConstraintDetails, ConstraintOptions, GuidanceSpan, EditHistoryEntry } from './types.js';
import type { ValidationOptions, ValidationResult, ValidationStats } from '../taxonomy-validation/types.js';
import type { ModelCapabilities } from './services/detection/ModelDetectionService.js';
import type { SectionConstraints } from './services/detection/SectionDetectionService.js';

/**
 * VideoPromptService - Main Orchestrator
 * 
 * Responsible for coordinating video prompt detection, analysis, and constraint management.
 * Delegates to specialized services for each concern.
 * 
 * Single Responsibility: Orchestrate video prompt logic
 */
export class VideoPromptService {
  private readonly detector: VideoPromptDetectionService;
  private readonly phraseRoleAnalyzer: PhraseRoleAnalysisService;
  private readonly constraintGenerator: ConstraintGenerationService;
  private readonly fallbackStrategy: FallbackStrategyService;
  private readonly categoryGuidance: CategoryGuidanceService;
  private readonly modelDetector: ModelDetectionService;
  private readonly sectionDetector: SectionDetectionService;
  private readonly taxonomyValidator: TaxonomyValidationService;

  constructor() {
    this.detector = new VideoPromptDetectionService();
    this.phraseRoleAnalyzer = new PhraseRoleAnalysisService();
    this.constraintGenerator = new ConstraintGenerationService();
    this.fallbackStrategy = new FallbackStrategyService();
    this.categoryGuidance = new CategoryGuidanceService();
    this.modelDetector = new ModelDetectionService();
    this.sectionDetector = new SectionDetectionService();
    this.taxonomyValidator = new TaxonomyValidationService();
  }

  /**
   * Count words in a string
   */
  countWords(text: string | null | undefined): number {
    return countWords(text);
  }

  /**
   * Check if this is a video prompt
   */
  isVideoPrompt(fullPrompt: string | null | undefined): boolean {
    return this.detector.isVideoPrompt(fullPrompt);
  }

  /**
   * Detect the likely role of a highlighted phrase within a video prompt
   */
  detectVideoPhraseRole(
    highlightedText: string | null | undefined,
    contextBefore: string | null | undefined,
    contextAfter: string | null | undefined,
    explicitCategory: string | null | undefined
  ): string {
    return this.phraseRoleAnalyzer.detectVideoPhraseRole(
      highlightedText,
      contextBefore,
      contextAfter,
      explicitCategory
    );
  }

  /**
   * Resolve video replacement constraints based on highlight context
   */
  getVideoReplacementConstraints(
    details: ConstraintDetails = {},
    options: ConstraintOptions = {}
  ): ConstraintConfig {
    return this.constraintGenerator.getVideoReplacementConstraints(details, options);
  }

  /**
   * Determine the next fallback constraint mode to try
   */
  getVideoFallbackConstraints(
    currentConstraints: ConstraintConfig | null | undefined,
    details: ConstraintDetails = {},
    attemptedModes: Set<string> = new Set()
  ): ConstraintConfig | null {
    return this.fallbackStrategy.getVideoFallbackConstraints(
      currentConstraints,
      details,
      attemptedModes,
      (d, o) => this.getVideoReplacementConstraints(d, o)
    );
  }

  /**
   * Get category-specific focus guidance for better suggestions
   * NEW: Now context-aware with full prompt, spans, and edit history
   */
  getCategoryFocusGuidance(
    phraseRole: string | null | undefined,
    categoryHint: string | null | undefined,
    fullContext: string = '',
    allSpans: GuidanceSpan[] = [],
    editHistory: EditHistoryEntry[] = []
  ): string[] | null {
    return this.categoryGuidance.getCategoryFocusGuidance(
      phraseRole,
      categoryHint,
      fullContext,
      allSpans,
      editHistory
    );
  }

  /**
   * Detect which AI video model is being targeted
   */
  detectTargetModel(fullPrompt: string | null | undefined): string | null {
    return this.modelDetector.detectTargetModel(fullPrompt);
  }

  /**
   * Get model capabilities (strengths and weaknesses)
   */
  getModelCapabilities(model: string | null | undefined): ModelCapabilities | null {
    return this.modelDetector.getModelCapabilities(model);
  }

  /**
   * Get model-specific guidance for a category
   */
  getModelSpecificGuidance(model: string | null | undefined, category: string | null | undefined): string[] {
    return this.modelDetector.getModelSpecificGuidance(model, category);
  }

  /**
   * Format model context for prompt inclusion
   */
  formatModelContext(model: string | null | undefined): string {
    return this.modelDetector.formatModelContext(model);
  }

  /**
   * Detect which section of the prompt template is being edited
   */
  detectPromptSection(
    highlightedText: string | null | undefined,
    fullPrompt: string | null | undefined,
    contextBefore: string = ''
  ): string {
    return this.sectionDetector.detectSection(highlightedText, fullPrompt, contextBefore);
  }

  /**
   * Get section-specific constraints
   */
  getSectionConstraints(section: string | null | undefined): SectionConstraints | null {
    return this.sectionDetector.getSectionConstraints(section);
  }

  /**
   * Get section-specific guidance for a category
   */
  getSectionGuidance(section: string | null | undefined, category: string | null | undefined): string[] {
    return this.sectionDetector.getSectionGuidance(section, category);
  }

  /**
   * Format section context for prompt inclusion
   */
  formatSectionContext(section: string | null | undefined): string {
    return this.sectionDetector.formatSectionContext(section);
  }

  /**
   * Validate taxonomy hierarchy in spans
   * NEW: Detects orphaned attributes and hierarchy violations
   */
  validateSpanHierarchy(
    spans: GuidanceSpan[],
    options: ValidationOptions = {}
  ): ValidationResult {
    return this.taxonomyValidator.validateSpans(spans, options);
  }

  /**
   * Check if spans have orphaned attributes
   * Quick check for UI warnings
   */
  hasOrphanedAttributes(spans: GuidanceSpan[]): boolean {
    return this.taxonomyValidator.hasOrphanedAttributes(spans);
  }

  /**
   * Get missing parent categories for validation suggestions
   */
  getMissingParentCategories(spans: GuidanceSpan[]): string[] {
    return this.taxonomyValidator.getMissingParents(spans);
  }

  /**
   * Validate before adding a category to spans
   */
  validateCategoryBeforeAdd(categoryId: string, existingSpans: GuidanceSpan[]) {
    return this.taxonomyValidator.validateBeforeAdd(categoryId, existingSpans);
  }

  /**
   * Get validation statistics for analytics
   */
  getValidationStats(spans: GuidanceSpan[]): ValidationStats {
    return this.taxonomyValidator.getValidationStats(spans);
  }
}

