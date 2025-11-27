import { logger } from '@infrastructure/Logger.js';
import { cacheService } from './cache/CacheService.js';

// Import specialized services
import {
  SuggestionGeneratorService,
  CompatibilityService,
  PreferenceRepository,
  SceneCompletionService,
  SceneVariationService,
  ConceptParsingService,
  RefinementService,
  TechnicalParameterService,
  PromptValidationService,
  ConflictDetectionService,
  VideoTemplateRepository,
} from './video-concept/index.js';
import type { AIService } from './prompt-optimization/types.js';
import type { VideoTemplate } from './video-concept/types.js';

/**
 * Video concept service options
 */
export interface VideoConceptServiceOptions {
  preferenceRepository?: PreferenceRepository;
  preferenceRepositoryOptions?: {
    storage?: unknown;
    maxChosenHistory?: number;
    maxRejectedHistory?: number;
  };
  templateRepository?: VideoTemplateRepository;
  templateRepositoryOptions?: {
    storage?: unknown;
  };
}

/**
 * Refactored Video Concept Service - Orchestrator Pattern
 *
 * This service now acts as a thin orchestrator, delegating to specialized services:
 * - SuggestionGeneratorService: Generates creative suggestions for elements
 * - CompatibilityService: Checks semantic and thematic compatibility
 * - PreferenceRepository: Manages user preference learning (supports persistence)
 * - SceneCompletionService: Fills empty scene elements
 * - SceneVariationService: Generates creative scene variations
 * - ConceptParsingService: Parses text concepts into structured elements
 * - RefinementService: Refines elements for better coherence
 * - TechnicalParameterService: Generates camera, lighting, and technical parameters
 * - PromptValidationService: Validates prompt quality and provides smart defaults
 * - ConflictDetectionService: Detects conflicts between elements
 * - VideoTemplateRepository: Manages template storage and recommendations
 *
 * Key improvements over the original 1,346-line God Object:
 * - Each service is small, focused, and testable (< 300 lines each)
 * - Clear separation of concerns
 * - Dependency injection for all services (easily testable/mockable)
 * - Repository pattern for data persistence
 * - Prepared for horizontal scaling (persistent storage adapters)
 *
 * Original anti-patterns fixed:
 * ✅ God Object → Orchestrator with specialized services
 * ✅ In-memory state → Repository pattern with pluggable storage
 * ✅ Hardcoded dependencies → Constructor injection
 * ✅ Mixed concerns → Single responsibility per service
 * ✅ Prompt logic scattered → Centralized in PromptBuilderService
 */
export class VideoConceptService {
  private readonly ai: AIService;
  private readonly preferenceRepository: PreferenceRepository;
  private readonly templateRepository: VideoTemplateRepository;
  private readonly compatibilityService: CompatibilityService;
  private readonly suggestionGenerator: SuggestionGeneratorService;
  private readonly sceneCompletion: SceneCompletionService;
  private readonly sceneVariation: SceneVariationService;
  private readonly conceptParsing: ConceptParsingService;
  private readonly refinement: RefinementService;
  private readonly technicalParameter: TechnicalParameterService;
  private readonly promptValidation: PromptValidationService;
  private readonly conflictDetection: ConflictDetectionService;

  constructor(aiService: AIService, options: VideoConceptServiceOptions = {}) {
    this.ai = aiService;

    // Initialize repository with optional storage adapter
    this.preferenceRepository = options.preferenceRepository ||
      new PreferenceRepository(options.preferenceRepositoryOptions);

    this.templateRepository = options.templateRepository ||
      new VideoTemplateRepository(options.templateRepositoryOptions);

    // Initialize compatibility service (needs cache for semantic scoring)
    this.compatibilityService = new CompatibilityService(aiService, cacheService);

    // Initialize suggestion generator (depends on preference repository and compatibility service)
    this.suggestionGenerator = new SuggestionGeneratorService(
      aiService,
      cacheService,
      this.preferenceRepository,
      this.compatibilityService
    );

    // Initialize scene analysis services
    this.sceneCompletion = new SceneCompletionService(aiService);
    this.sceneVariation = new SceneVariationService(aiService);
    this.conceptParsing = new ConceptParsingService(aiService);
    this.refinement = new RefinementService(aiService);

    // Initialize technical parameter and validation services
    this.technicalParameter = new TechnicalParameterService(aiService);
    this.promptValidation = new PromptValidationService(aiService);

    // Initialize conflict detection
    this.conflictDetection = new ConflictDetectionService(aiService);

    logger.info('VideoConceptService initialized with orchestrator pattern');
  }

  // ==================== Suggestion Generation ====================

  /**
   * Generate creative suggestions for a video element
   * Delegates to SuggestionGeneratorService
   */
  async getCreativeSuggestions(params: {
    elementType: string;
    currentValue?: string;
    context?: Record<string, string>;
    concept?: string;
    userId?: string;
  }) {
    return this.suggestionGenerator.getCreativeSuggestions(params);
  }

  /**
   * Get alternative phrasings for an element
   * Delegates to SuggestionGeneratorService
   */
  async getAlternativePhrasings(params: {
    elementType: string;
    value: string;
  }) {
    return this.suggestionGenerator.getAlternativePhrasings(params);
  }

  // ==================== Compatibility Checking ====================

  /**
   * Check compatibility between element value and existing elements
   * Delegates to CompatibilityService
   */
  async checkCompatibility(params: {
    elementType: string;
    value: string;
    existingElements: Record<string, string>;
  }) {
    return this.compatibilityService.checkCompatibility(params);
  }

  // ==================== User Preference Learning ====================

  /**
   * Record user choice for preference learning
   * Delegates to PreferenceRepository
   */
  async recordUserChoice(
    elementType: string,
    chosen: string,
    rejected: string[],
    userId: string = 'default'
  ) {
    return this.preferenceRepository.recordChoice(userId, elementType, chosen, rejected);
  }

  /**
   * Clear user preferences
   * Delegates to PreferenceRepository
   */
  async clearUserPreferences(userId: string, elementType?: string | null) {
    return this.preferenceRepository.clearPreferences(userId, elementType);
  }

  /**
   * Get all user preferences
   * Delegates to PreferenceRepository
   */
  async getUserPreferences(userId: string) {
    return this.preferenceRepository.getAllPreferences(userId);
  }

  // ==================== Scene Analysis ====================

  /**
   * Complete scene by suggesting all empty elements
   * Delegates to SceneCompletionService
   */
  async completeScene(params: {
    existingElements: Record<string, string>;
    concept: string;
  }) {
    return this.sceneCompletion.completeScene(params);
  }

  /**
   * Generate variations of current element setup
   * Delegates to SceneVariationService
   */
  async generateVariations(params: {
    elements: Record<string, string>;
    concept: string;
  }) {
    return this.sceneVariation.generateVariations(params);
  }

  /**
   * Parse a concept description into individual elements
   * Delegates to ConceptParsingService
   */
  async parseConcept(params: { concept: string }) {
    return this.conceptParsing.parseConcept(params);
  }

  /**
   * Get refined suggestions based on progressive context
   * Delegates to RefinementService
   */
  async getRefinementSuggestions(params: {
    elements: Record<string, string>;
  }) {
    return this.refinement.getRefinementSuggestions(params);
  }

  /**
   * Generate technical parameters based on elements
   * Delegates to TechnicalParameterService
   */
  async generateTechnicalParams(params: {
    elements: Record<string, string>;
  }) {
    return this.technicalParameter.generateTechnicalParams(params);
  }

  /**
   * Validate prompt quality and completeness
   * Delegates to PromptValidationService
   */
  async validatePrompt(params: {
    elements: Record<string, string>;
    concept?: string;
  }) {
    return this.promptValidation.validatePrompt(params);
  }

  /**
   * Get smart defaults for dependent elements
   * Delegates to PromptValidationService
   */
  async getSmartDefaults(params: {
    elementType: string;
    existingElements: Record<string, string>;
  }) {
    return this.promptValidation.getSmartDefaults(params);
  }

  // ==================== Conflict Detection ====================

  /**
   * Detect conflicts between elements
   * Delegates to ConflictDetectionService
   */
  async detectConflicts(params: {
    elements: Record<string, string>;
  }) {
    return this.conflictDetection.detectConflicts(params);
  }

  // ==================== Template Management ====================

  /**
   * Save template for reuse
   * Delegates to VideoTemplateRepository
   */
  async saveTemplate(params: {
    name: string;
    elements: Record<string, string>;
    concept: string;
    userId: string;
  }) {
    return this.templateRepository.saveTemplate(params);
  }

  /**
   * Get template by ID
   * Delegates to VideoTemplateRepository
   */
  async getTemplate(templateId: string): Promise<VideoTemplate | null> {
    return this.templateRepository.getTemplate(templateId);
  }

  /**
   * Get all templates for a user
   * Delegates to VideoTemplateRepository
   */
  async getUserTemplates(userId: string) {
    return this.templateRepository.getUserTemplates(userId);
  }

  /**
   * Get template recommendations based on usage
   * Delegates to VideoTemplateRepository
   */
  async getTemplateRecommendations(params: {
    userId: string;
    currentElements?: Record<string, string>;
  }) {
    return this.templateRepository.getTemplateRecommendations(params);
  }

  /**
   * Delete template
   * Delegates to VideoTemplateRepository
   */
  async deleteTemplate(templateId: string, userId: string) {
    return this.templateRepository.deleteTemplate(templateId, userId);
  }

  /**
   * Update template
   * Delegates to VideoTemplateRepository
   */
  async updateTemplate(templateId: string, updates: Partial<VideoTemplate>, userId: string) {
    return this.templateRepository.updateTemplate(templateId, updates, userId);
  }

  /**
   * Increment template usage count
   * Delegates to VideoTemplateRepository
   */
  async incrementTemplateUsage(templateId: string) {
    return this.templateRepository.incrementUsageCount(templateId);
  }

  // ==================== Utility Methods ====================

  /**
   * Clear all caches
   */
  clearCaches(): void {
    this.compatibilityService.clearCache();
    logger.info('All caches cleared');
  }
}

