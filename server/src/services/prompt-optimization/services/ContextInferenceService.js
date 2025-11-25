import { logger } from '../infrastructure/Logger.ts';
import OptimizationConfig from '../../../config/OptimizationConfig.js';

/**
 * Service for inferring context from user prompts
 * Analyzes prompts to determine domain, expertise level, and intended use
 */
export class ContextInferenceService {
  constructor(aiService) {
    this.ai = aiService;
  }

  /**
   * Automatically infer context from prompt using Claude
   * @param {string} prompt - The user's original prompt
   * @returns {Promise<Object>} Context object with specificAspects, backgroundLevel, intendedUse
   */
  async inferContext(prompt) {
    logger.info('Inferring context from prompt', { promptLength: prompt.length });

    try {
      const inferencePrompt = this.buildInferencePrompt(prompt);

      const response = await this.ai.execute('optimize_context_inference', {
        systemPrompt: inferencePrompt,
        maxTokens: OptimizationConfig.tokens.contextInference,
        temperature: OptimizationConfig.temperatures.contextInference,
        timeout: OptimizationConfig.timeouts.contextInference,
      });

      const rawOutput = response.content[0].text.trim();
      logger.debug('Raw inference output', { rawOutput: rawOutput.substring(0, 200) });

      // Extract and parse JSON from response
      const context = this.parseContextFromResponse(rawOutput);

      logger.info('Context inference successful', {
        backgroundLevel: context.backgroundLevel,
        intendedUse: context.intendedUse,
      });

      return context;
    } catch (error) {
      logger.error('Context inference failed', { error: error.message });
      // Return sensible defaults on failure
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: 'general purpose',
      };
    }
  }

  /**
   * Build the inference prompt
   * @private
   */
  buildInferencePrompt(prompt) {
    return `Analyze this prompt and infer appropriate context for optimization.

<prompt_to_analyze>
${prompt}
</prompt_to_analyze>

Your task: Reason through these analytical lenses to infer the appropriate context:

**LENS 1: Domain & Specificity**
What field or discipline does this belong to? What level of technical depth is implied?

**LENS 2: Expertise Level**
Based on language complexity and terminology usage, how expert is this person?
- novice: Uses general language, asks "what is" questions, seeks basic explanations
- intermediate: Uses some domain terms, asks "how to" questions, seeks practical guidance
- expert: Uses precise terminology, discusses trade-offs, assumes domain knowledge

**LENS 3: Key Focus Areas**
What are the 2-4 most important specific aspects or focus areas in this prompt?
Be concrete - extract the actual technical concepts, tools, or constraints mentioned.

**LENS 4: Intended Use**
What is this person likely trying to do with the response?
- learning/education
- production implementation
- research/analysis
- troubleshooting/debugging
- strategic planning
- creative development

Now, output ONLY a JSON object with this exact structure (no other text):

{
  "specificAspects": "2-4 key technical/domain-specific focus areas from the prompt",
  "backgroundLevel": "novice|intermediate|expert",
  "intendedUse": "brief description of likely use case"
}

Examples of good output:

For: "analyze the current implementation behind the prompt canvas editor highlighting feature, and help me come up with a solution to reduce the amount of time it takes to parse the text and apply the highlights"
{
  "specificAspects": "DOM manipulation performance, text parsing algorithms, real-time highlighting optimization, editor rendering efficiency",
  "backgroundLevel": "expert",
  "intendedUse": "production performance optimization"
}

For: "help me understand how neural networks learn"
{
  "specificAspects": "backpropagation mechanics, gradient descent, loss functions, weight updates",
  "backgroundLevel": "novice",
  "intendedUse": "learning fundamentals"
}

Output only the JSON, nothing else:`;
  }

  /**
   * Parse context from LLM response
   * @private
   */
  parseContextFromResponse(rawOutput) {
    let jsonText = rawOutput;

    // Remove markdown code fences if present
    const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    // Parse JSON
    const context = JSON.parse(jsonText);

    // Validate required fields
    if (!context.specificAspects || !context.backgroundLevel || !context.intendedUse) {
      throw new Error('Invalid context structure: missing required fields');
    }

    return context;
  }
}

export default ContextInferenceService;

