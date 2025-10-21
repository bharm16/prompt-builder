import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';
import { StructuredOutputEnforcer } from '../utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '../utils/TemperatureOptimizer.js';

/**
 * Service for detecting scene changes in video prompts
 * Determines if field changes require updating related fields
 */
export class SceneDetectionService {
  constructor(claudeClient) {
    this.claudeClient = claudeClient;
    this.cacheConfig = cacheService.getConfig('sceneDetection');
  }

  /**
   * Detect if a field change represents a scene change
   * @param {Object} params - Detection parameters
   * @returns {Promise<Object>} Detection result with suggestions
   */
  async detectSceneChange({
    changedField,
    newValue,
    oldValue,
    fullPrompt,
    affectedFields,
    sectionHeading,
    sectionContext,
  }) {
    logger.info('Detecting scene change', {
      changedField,
      hasOldValue: !!oldValue,
      hasNewValue: !!newValue,
    });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      changedField,
      newValue,
      oldValue,
      fullPrompt: fullPrompt.substring(0, 500),
      sectionHeading,
    });

    const cached = await cacheService.get(cacheKey, 'scene-detection');
    if (cached) {
      logger.debug('Cache hit for scene detection');
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt({
      changedField,
      newValue,
      oldValue,
      fullPrompt,
      affectedFields,
      sectionHeading,
      sectionContext,
    });

    // Define schema for validation
    const schema = {
      type: 'object',
      required: ['isSceneChange', 'confidence', 'reasoning', 'suggestedUpdates'],
    };

    // Get optimal temperature for scene detection
    const temperature = TemperatureOptimizer.getOptimalTemperature('scene-detection', {
      diversity: 'low',
      precision: 'high',
    });

    // Call Claude API with structured output enforcement
    const result = await StructuredOutputEnforcer.enforceJSON(
      this.claudeClient,
      systemPrompt,
      {
        schema,
        isArray: false, // Expecting object
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    );

    // Cache the result
    await cacheService.set(cacheKey, result, {
      ttl: this.cacheConfig.ttl,
    });

    logger.info('Scene change detection completed', {
      isSceneChange: result.isSceneChange,
      confidence: result.confidence,
    });

    return result;
  }

  /**
   * Build system prompt for scene detection
   * @private
   */
  buildSystemPrompt({
    changedField,
    newValue,
    oldValue,
    fullPrompt,
    affectedFields,
    sectionHeading,
    sectionContext,
  }) {
    return `You are an expert video production assistant with deep understanding of scene coherence and environmental compatibility.

<analysis_process>
Step 1: Assess the magnitude of change
- Old value: "${oldValue || 'Not set'}"
- New value: "${newValue}"
- Field: ${changedField}
- Is this a refinement within the same environment, or a fundamental location/environment shift?

Step 2: Evaluate environmental compatibility
- What environmental assumptions does the old value imply?
- What environmental assumptions does the new value imply?
- Are these compatible or contradictory?
- Example: "coffee shop" → "vintage coffee shop" (compatible refinement)
- Example: "coffee shop" → "underwater cave" (incompatible scene change)

Step 3: Analyze impact on related fields
- Review affected fields: ${JSON.stringify(affectedFields, null, 2)}
- For each field, would current values still make sense?
- Which fields would become nonsensical or incompatible?

Step 4: Determine confidence level
- HIGH: Clear and obvious scene change (indoor → outdoor, urban → nature, earth → space)
- MEDIUM: Significant change but some overlap (city street → suburban street)
- LOW: Minor refinement or ambiguous case

Step 5: Generate suggestions if needed
- If scene change detected, suggest coherent values for ALL affected fields
- Ensure suggestions maintain thematic and visual consistency with new environment
</analysis_process>

**Field Changed:** ${changedField}
**Old Value:** "${oldValue || 'Not set'}"
**New Value:** "${newValue}"

**Section:** ${sectionHeading || 'Unknown section'}

**Relevant Section Content:**
${sectionContext ? sectionContext.substring(0, 1500) : 'Not provided'}

**Full Prompt Context (truncated):**
${fullPrompt.substring(0, 1500)}

**Potentially Affected Fields:**
${JSON.stringify(affectedFields, null, 2)}

**Your Task:**
Determine if this represents a COMPLETE SCENE/ENVIRONMENT CHANGE requiring updates to related fields.

**Scene Change Criteria:**
✓ Fundamentally different environment/location (not just refinement)
✓ Would make existing related field values incompatible or nonsensical
✓ Requires rethinking architectural, atmospheric, or environmental details

**Output Format:**
Return ONLY a JSON object (no markdown, no code blocks):

{
  "isSceneChange": true,
  "confidence": "high",
  "reasoning": "clear explanation of the environmental incompatibility",
  "suggestedUpdates": {
    "field1": "specific value fitting new environment",
    "field2": "specific value fitting new environment"
  }
}

**Important:**
- If isSceneChange is FALSE: return suggestedUpdates as empty object {}
- If isSceneChange is TRUE: provide specific suggested values for ALL affected fields`;
  }
}
