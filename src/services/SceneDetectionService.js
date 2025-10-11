import { logger } from '../infrastructure/Logger.js';
import { cacheService } from './CacheService.js';

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
    });

    // Call Claude API
    const response = await this.claudeClient.complete(systemPrompt, {
      maxTokens: 2048,
    });

    // Parse response
    let resultText = response.content[0].text;
    resultText = resultText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const result = JSON.parse(resultText);

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
  }) {
    return `You are an expert video production assistant analyzing whether a field change represents a COMPLETE SCENE/ENVIRONMENT CHANGE that would require updating related fields.

**Field that changed:** ${changedField}
**Old value:** "${oldValue || 'Not set'}"
**New value:** "${newValue}"

**Full prompt context:**
${fullPrompt.substring(0, 1500)}

**Your task:**
Determine if this change represents a COMPLETE SCENE CHANGE (like changing from "coffee shop interior" to "underwater cave" or "urban street" to "mountain peak").

**Analysis criteria:**
- Does the new value describe a fundamentally different ENVIRONMENT/LOCATION than the old value?
- Would this change make the current values in related fields (architectural details, atmospheric conditions, background elements, etc.) INCOMPATIBLE or NONSENSICAL?
- Is this a minor refinement (e.g., "modern coffee shop" → "vintage coffee shop") or a major scene change (e.g., "coffee shop" → "underwater cave")?

**Related fields that might need updating if this is a scene change:**
${JSON.stringify(affectedFields, null, 2)}

Return ONLY a JSON object in this exact format (no markdown, no code blocks):

{
  "isSceneChange": true or false,
  "confidence": "high" or "medium" or "low",
  "reasoning": "brief explanation of why this is or isn't a scene change",
  "suggestedUpdates": {
    "field1": "suggested new value that fits the new environment",
    "field2": "suggested new value that fits the new environment"
  }
}

If isSceneChange is FALSE, return suggestedUpdates as an empty object {}.
If isSceneChange is TRUE, provide specific suggested values for ALL affected fields that would fit the new environment.`;
  }
}
