/**
 * Context Inference Service
 * 
 * SOLID Principles Applied:
 * - SRP: Focused solely on context inference
 * - DIP: Depends on IAIClient and ILogger abstractions
 */
export class ContextInferenceService {
  constructor({ client, logger = null }) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Infer context from prompt
   * @param {string} prompt - User's original prompt
   * @returns {Promise<Object>} Inferred context
   */
  async infer(prompt) {
    this.logger?.info('Inferring context from prompt', { promptLength: prompt.length });

    try {
      const inferencePrompt = this._buildInferencePrompt(prompt);
      
      const response = await this.client.complete(inferencePrompt, {
        maxTokens: 500,
        temperature: 0.3,
        timeout: 15000,
      });

      const inferredContext = this._parseResponse(response.text);
      
      this.logger?.info('Successfully inferred context', {
        hasSpecificAspects: !!inferredContext.specificAspects,
        backgroundLevel: inferredContext.backgroundLevel,
        hasIntendedUse: !!inferredContext.intendedUse,
      });

      return inferredContext;
      
    } catch (error) {
      this.logger?.error('Failed to infer context', error);
      
      // Return minimal context on failure
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: '',
      };
    }
  }

  _buildInferencePrompt(prompt) {
    return `Analyze this prompt and infer appropriate context.

<prompt_to_analyze>
${prompt}
</prompt_to_analyze>

Reason through these lenses:

**Domain & Specificity**: What field does this belong to?
**Expertise Level**: Based on language, is this person novice/intermediate/expert?
**Key Focus Areas**: What are the 2-4 most important aspects?
**Intended Use**: What will they do with the response?

Output ONLY JSON:

{
  "specificAspects": "2-4 key focus areas from the prompt",
  "backgroundLevel": "novice|intermediate|expert",
  "intendedUse": "brief description of use case"
}`;
  }

  _parseResponse(text) {
    // Extract and parse JSON
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      jsonText = jsonMatch[1] || jsonMatch[0];
    }

    const parsed = JSON.parse(jsonText);
    
    // Validate background level
    const validLevels = ['novice', 'intermediate', 'expert'];
    if (!validLevels.includes(parsed.backgroundLevel)) {
      parsed.backgroundLevel = 'intermediate';
    }
    
    return parsed;
  }
}
