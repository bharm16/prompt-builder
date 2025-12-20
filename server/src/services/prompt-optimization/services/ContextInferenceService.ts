import { logger } from '@infrastructure/Logger';
import OptimizationConfig from '@config/OptimizationConfig';
import type { AIService, InferredContext } from '../types';

/**
 * Service for inferring context from user prompts
 * Analyzes prompts to determine domain, expertise level, and intended use
 */
export class ContextInferenceService {
  private readonly ai: AIService;
  private readonly log = logger.child({ service: 'ContextInferenceService' });

  constructor(aiService: AIService) {
    this.ai = aiService;
    
    this.log.debug('ContextInferenceService initialized', {
      operation: 'constructor',
    });
  }

  /**
   * Automatically infer context from prompt using Claude
   */
  async inferContext(prompt: string): Promise<InferredContext> {
    const operation = 'inferContext';
    const startTime = performance.now();
    
    this.log.debug(`Starting ${operation}`, {
      operation,
      promptLength: prompt.length,
    });

    try {
      const inferencePrompt = this.buildInferencePrompt(prompt);

      const response = await this.ai.execute('optimize_context_inference', {
        systemPrompt: inferencePrompt,
        maxTokens: OptimizationConfig.tokens.contextInference,
        temperature: OptimizationConfig.temperatures.contextInference,
        timeout: OptimizationConfig.timeouts.contextInference,
      });

      const rawOutput = (response.text || response.content?.[0]?.text || '').trim();
      this.log.debug(`${operation}: Received LLM response`, {
        operation,
        outputLength: rawOutput.length,
        outputPreview: rawOutput.substring(0, 200),
      });

      // Extract and parse JSON from response
      const context = this.parseContextFromResponse(rawOutput);

      const duration = Math.round(performance.now() - startTime);
      this.log.info(`${operation} completed`, {
        operation,
        duration,
        backgroundLevel: context.backgroundLevel,
        intendedUse: context.intendedUse,
        promptLength: prompt.length,
      });

      return context;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);
      this.log.error(`${operation} failed`, error as Error, {
        operation,
        duration,
        promptLength: prompt.length,
      });
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
   */
  buildInferencePrompt(prompt: string): string {
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
   */
  parseContextFromResponse(rawOutput: string): InferredContext {
    let jsonText = rawOutput;

    // Remove markdown code fences if present
    const jsonMatch = rawOutput.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonText = jsonMatch[1];
    }

    try {
      // Parse JSON
      const context = JSON.parse(jsonText);

      // Validate required fields
      if (!context.specificAspects || !context.backgroundLevel || !context.intendedUse) {
        throw new Error('Invalid context structure: missing required fields');
      }

      // Normalize background level
      const normalizedLevel = this.normalizeBackgroundLevel(context.backgroundLevel);

      return {
        specificAspects: context.specificAspects,
        backgroundLevel: normalizedLevel,
        intendedUse: context.intendedUse,
      };
    } catch (error) {
      this.log.warn('Failed to parse context JSON', {
        error: (error as Error).message,
        errorName: (error as Error).name,
      });
      // Return defaults on parse failure
      return {
        specificAspects: '',
        backgroundLevel: 'intermediate',
        intendedUse: 'general purpose',
      };
    }
  }

  /**
   * Normalize background level from various formats
   */
  private normalizeBackgroundLevel(level: string | undefined): 'beginner' | 'intermediate' | 'advanced' {
    if (!level) return 'intermediate';
    const normalized = level.toLowerCase();
    if (normalized.includes('novice') || normalized.includes('beginner') || normalized.includes('basic')) {
      return 'beginner';
    }
    if (normalized.includes('advanced') || normalized.includes('expert')) {
      return 'advanced';
    }
    return 'intermediate';
  }
}
