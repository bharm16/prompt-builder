import nlp from 'compromise';
import { logger } from '../../../infrastructure/Logger.js';
import { StructuredOutputEnforcer } from '../../../utils/StructuredOutputEnforcer.js';
import { getEnhancementSchema } from '../config/schemas.js';
import { GRAMMATICAL_CONFIG, calculateRetryParams } from '../config/grammaticalAnalysis.js';

/**
 * ResilientGenerationService
 * 
 * Handles LLM generation with retry-validation loop and dynamic temperature adjustment.
 * Validates output structure and tense, providing correction instructions on failures.
 * 
 * Single Responsibility: Resilient LLM generation with structural validation
 */
export class ResilientGenerationService {
  constructor(llmClient, promptBuilder, config = GRAMMATICAL_CONFIG) {
    this.llmClient = llmClient;
    this.promptBuilder = promptBuilder;
    this.config = config;
    this.maxRetries = config.retry.maxAttempts;
  }

  /**
   * Generate enhanced suggestions with retry-validation loop
   * @param {Object} params - Generation parameters (same as enhancement params)
   * @param {Object} analysis - Grammatical analysis result
   * @param {number} maxRetries - Maximum retry attempts (default from config)
   * @returns {Promise<Array|null>} Array of suggestions or null if all retries fail
   */
  async generate(params, analysis, maxRetries = this.maxRetries) {
    let attempts = 0;
    let lastError = null;

    while (attempts < maxRetries) {
      try {
        // 1. Calculate Dynamic Parameters (Hot -> Cold)
        const { temperature, strictness } = calculateRetryParams(attempts, maxRetries);

        logger.debug('Resilient generation attempt', {
          attempt: attempts + 1,
          maxRetries,
          temperature: temperature.toFixed(3),
          strictness: strictness.toFixed(3),
          hasLastError: Boolean(lastError),
        });

        // 2. Build Prompt with increasing strictness
        const systemPrompt = this._buildPromptWithRetryContext(
          params,
          analysis,
          strictness,
          lastError
        );

        // 3. Generate using existing StructuredOutputEnforcer pattern
        const schema = getEnhancementSchema(false); // Not placeholder
        const suggestions = await StructuredOutputEnforcer.enforceJSON(
          this.llmClient,
          systemPrompt,
          {
            schema,
            isArray: true,
            maxTokens: 1024,
            maxRetries: 1, // We handle retries ourselves
            temperature,
          }
        );

        // 4. Validate Structure for each suggestion
        const validatedSuggestions = [];
        let hasInvalidSuggestion = false;

        for (const suggestion of suggestions) {
          const validation = this._validateStructure(suggestion.text, analysis);

          if (validation.isValid) {
            validatedSuggestions.push(suggestion);
          } else {
            hasInvalidSuggestion = true;
            lastError = {
              badOutput: suggestion.text,
              instruction: validation.correctionInstruction,
              reason: validation.reason,
            };
            logger.debug('Suggestion validation failed', {
              text: suggestion.text.substring(0, 50),
              reason: validation.reason,
            });
          }
        }

        // If we have at least one valid suggestion, return them
        if (validatedSuggestions.length > 0) {
          logger.info('Resilient generation succeeded', {
            attempts: attempts + 1,
            validSuggestions: validatedSuggestions.length,
            totalGenerated: suggestions.length,
          });
          return validatedSuggestions;
        }

        // All suggestions failed validation, prepare for retry
        if (hasInvalidSuggestion) {
          attempts++;
          logger.warn(`Resilient generation retry ${attempts}/${maxRetries}`, {
            reason: lastError.reason,
          });
        } else {
          // No suggestions generated at all
          logger.error('No suggestions generated');
          return null;
        }
      } catch (error) {
        logger.error('Error during resilient generation', {
          attempt: attempts + 1,
          error: error.message,
        });
        attempts++;
        
        if (attempts >= maxRetries) {
          logger.error('Resilient generation exhausted retries', {
            attempts,
            lastError: error.message,
          });
          return null;
        }
      }
    }

    logger.warn('Resilient generation failed after all retries', {
      attempts,
      maxRetries,
    });
    return null;
  }

  /**
   * Build prompt with retry context and correction instructions
   * @param {Object} params - Generation parameters
   * @param {Object} analysis - Grammatical analysis
   * @param {number} strictness - Strictness level (0.0 to 1.0)
   * @param {Object|null} lastError - Previous error with correction instructions
   * @returns {string} System prompt
   * @private
   */
  _buildPromptWithRetryContext(params, analysis, strictness, lastError) {
    // Start with base rewrite prompt
    let systemPrompt = this.promptBuilder.buildRewritePrompt({
      highlightedText: params.highlightedText,
      contextBefore: params.contextBefore,
      contextAfter: params.contextAfter,
      fullPrompt: params.fullPrompt,
      originalUserPrompt: params.originalUserPrompt,
      isVideoPrompt: params.isVideoPrompt || false,
      brainstormContext: params.brainstormContext,
      phraseRole: params.phraseRole,
      highlightWordCount: params.highlightWordCount,
      videoConstraints: params.videoConstraints,
      highlightedCategory: params.highlightedCategory,
      highlightedCategoryConfidence: params.highlightedCategoryConfidence,
      dependencyContext: params.dependencyContext,
      elementDependencies: params.elementDependencies,
      allLabeledSpans: params.allLabeledSpans || [],
      nearbySpans: params.nearbySpans || [],
      editHistory: params.editHistory || [],
      modelTarget: params.modelTarget,
      promptSection: params.promptSection,
    });

    // Add structure enforcement based on analysis
    const structureRequirements = this._buildStructureRequirements(analysis, strictness);
    if (structureRequirements) {
      systemPrompt += `\n\n${structureRequirements}`;
    }

    // Add correction instructions from previous failure
    if (lastError) {
      const correctionSection = this._buildCorrectionSection(lastError, strictness);
      systemPrompt += `\n\n${correctionSection}`;
    }

    return systemPrompt;
  }

  /**
   * Build structure requirement instructions
   * @param {Object} analysis - Grammatical analysis
   * @param {number} strictness - Strictness level
   * @returns {string} Structure requirements text
   * @private
   */
  _buildStructureRequirements(analysis, strictness) {
    const { structure, tense, isPlural } = analysis;
    let requirements = '**CRITICAL STRUCTURAL REQUIREMENTS:**\n';
    let hasRequirements = false;

    // Gerund phrase requirements
    if (structure === 'gerund_phrase') {
      requirements += '- MUST start with an -ing verb form (gerund)\n';
      requirements += '- Examples: "Running swiftly", "Cascading down", "Glowing softly"\n';
      hasRequirements = true;
    }

    // Prepositional phrase requirements
    if (structure === 'prepositional_phrase') {
      requirements += '- MUST start with a preposition\n';
      requirements += '- Examples: "Under the bridge", "Through the mist", "Along the coast"\n';
      hasRequirements = true;
    }

    // Tense preservation
    if (tense !== 'neutral') {
      const tenseLabel = tense.toUpperCase();
      requirements += `- MUST preserve ${tenseLabel} tense\n`;
      hasRequirements = true;
    }

    // Plurality preservation
    if (isPlural) {
      requirements += '- MUST maintain plural form\n';
      hasRequirements = true;
    }

    // Strictness-based emphasis
    if (strictness > 0.7) {
      requirements += '\n**VALIDATION WILL BE STRICT. ANY DEVIATION WILL FAIL.**\n';
      hasRequirements = true;
    }

    return hasRequirements ? requirements : '';
  }

  /**
   * Build correction section from previous failure
   * @param {Object} lastError - Previous error information
   * @param {number} strictness - Strictness level
   * @returns {string} Correction instructions
   * @private
   */
  _buildCorrectionSection(lastError, strictness) {
    let section = '**CORRECTION REQUIRED:**\n';
    section += `Your previous attempt was REJECTED: "${lastError.badOutput.substring(0, 80)}..."\n`;
    section += `Reason: ${lastError.reason}\n`;
    section += `\n${lastError.instruction}\n`;

    if (strictness > 0.8) {
      section += '\n**THIS IS YOUR FINAL ATTEMPT. FOLLOW THE REQUIREMENTS EXACTLY.**\n';
    }

    return section;
  }

  /**
   * Validate structural properties of generated text
   * @param {string} text - Generated text to validate
   * @param {Object} targetAnalysis - Target analysis from original text
   * @returns {Object} Validation result with isValid, reason, correctionInstruction
   * @private
   */
  _validateStructure(text, targetAnalysis) {
    if (!text || typeof text !== 'string') {
      return {
        isValid: false,
        reason: 'Empty or invalid output',
        correctionInstruction: 'Generate valid text output.',
      };
    }

    const doc = nlp(text);
    const firstTerm = doc.terms().first();

    // Case: Gerund phrase validation
    if (targetAnalysis.structure === 'gerund_phrase') {
      if (!firstTerm.has('#Gerund')) {
        return {
          isValid: false,
          reason: 'Structure Mismatch - Expected gerund phrase',
          correctionInstruction:
            'The phrase MUST start with an -ing verb form (e.g., "cascading", "glimmering", "running").',
        };
      }
    }

    // Case: Prepositional phrase validation
    if (targetAnalysis.structure === 'prepositional_phrase') {
      if (!firstTerm.has('#Preposition')) {
        return {
          isValid: false,
          reason: 'Structure Mismatch - Expected prepositional phrase',
          correctionInstruction:
            'The phrase MUST start with a preposition (e.g., "in", "under", "through", "along").',
        };
      }
    }

    // Case: Tense preservation
    if (targetAnalysis.tense === 'past') {
      const verbs = doc.verbs();
      if (verbs.found && !verbs.has('#PastTense')) {
        return {
          isValid: false,
          reason: 'Tense Mismatch - Expected past tense',
          correctionInstruction: 'Rewrite the action in the PAST tense.',
        };
      }
    }

    if (targetAnalysis.tense === 'future') {
      const verbs = doc.verbs();
      if (verbs.found && !verbs.has('#FutureTense')) {
        return {
          isValid: false,
          reason: 'Tense Mismatch - Expected future tense',
          correctionInstruction: 'Rewrite the action in the FUTURE tense.',
        };
      }
    }

    // All validations passed
    return { isValid: true };
  }
}

export default ResilientGenerationService;

