import { logger } from '@infrastructure/Logger.js';
import { cacheService } from '@services/cache/CacheService.js';
import { StructuredOutputEnforcer } from '@utils/StructuredOutputEnforcer.js';
import { TemperatureOptimizer } from '@utils/TemperatureOptimizer.js';
import type { AIService } from '../../../prompt-optimization/types.js';

/**
 * Scene change detection result
 */
export interface SceneChangeResult {
  isSceneChange: boolean;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  suggestedUpdates: Record<string, string>;
}

/**
 * Service for detecting scene changes in video prompts
 * Determines if field changes require updating related fields
 * 
 * Moved from SceneDetectionService.js to video-concept folder for better
 * logical grouping with other scene-related services (SceneAnalysisService,
 * ConflictDetectionService).
 */
export class SceneChangeDetectionService {
  private readonly ai: AIService;
  private readonly cacheConfig: { ttl: number; namespace: string };

  constructor(aiService: AIService) {
    this.ai = aiService;
    this.cacheConfig = cacheService.getConfig('sceneDetection');
  }

  /**
   * Detect if a field change represents a scene change
   */
  async detectSceneChange(params: {
    changedField: string;
    newValue: string;
    oldValue?: string | null;
    fullPrompt: string;
    affectedFields: string[];
    sectionHeading?: string | null;
    sectionContext?: string | null;
  }): Promise<SceneChangeResult> {
    logger.info('Detecting scene change', {
      changedField: params.changedField,
      hasOldValue: !!params.oldValue,
      hasNewValue: !!params.newValue,
    });

    // Check cache
    const cacheKey = cacheService.generateKey(this.cacheConfig.namespace, {
      changedField: params.changedField,
      newValue: params.newValue,
      oldValue: params.oldValue,
      fullPrompt: params.fullPrompt.substring(0, 500),
      sectionHeading: params.sectionHeading,
    });

    const cached = await cacheService.get<SceneChangeResult>(cacheKey, 'scene-detection');
    if (cached) {
      logger.debug('Cache hit for scene detection');
      return cached;
    }

    // Build system prompt
    const systemPrompt = this.buildSystemPrompt(params);

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

    // Call AI service with structured output enforcement
    const result = await StructuredOutputEnforcer.enforceJSON(
      this.ai,
      systemPrompt,
      {
        operation: 'video_scene_change_detection',
        schema,
        isArray: false, // Expecting object
        maxTokens: 2048,
        maxRetries: 2,
        temperature,
      }
    ) as SceneChangeResult;

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
   */
  private buildSystemPrompt(params: {
    changedField: string;
    newValue: string;
    oldValue?: string | null;
    fullPrompt: string;
    affectedFields: string[];
    sectionHeading?: string | null;
    sectionContext?: string | null;
  }): string {
    return `You are an expert video production assistant with deep understanding of scene coherence and environmental compatibility.

<analysis_process>
Step 1: Assess the magnitude of change
- Old value: "${params.oldValue || 'Not set'}"
- New value: "${params.newValue}"
- Field: ${params.changedField}
- Is this a refinement within the same environment, or a fundamental location/environment shift?

Step 2: Evaluate environmental compatibility
- What environmental assumptions does the old value imply?
- What environmental assumptions does the new value imply?
- Are these compatible or contradictory?
- Example: "coffee shop" → "vintage coffee shop" (compatible refinement)
- Example: "coffee shop" → "underwater cave" (incompatible scene change)

Step 3: Analyze impact on related fields
- Review affected fields: ${JSON.stringify(params.affectedFields, null, 2)}
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

**Field Changed:** ${params.changedField}
**Old Value:** "${params.oldValue || 'Not set'}"
**New Value:** "${params.newValue}"

**Section:** ${params.sectionHeading || 'Unknown section'}

**Relevant Section Content:**
${params.sectionContext ? params.sectionContext.substring(0, 1500) : 'Not provided'}

**Full Prompt Context (truncated):**
${params.fullPrompt.substring(0, 1500)}

**Potentially Affected Fields:**
${JSON.stringify(params.affectedFields, null, 2)}

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

