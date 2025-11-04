import { IOptimizationMode } from '../interfaces/IOptimizationMode.js';

/**
 * Reasoning Optimization Mode
 * 
 * SOLID Principles Applied:
 * - SRP: Handles only reasoning-specific logic
 * - OCP: Can be added/removed without affecting other modes
 * - LSP: Properly implements IOptimizationMode contract
 */
export class ReasoningMode extends IOptimizationMode {
  constructor({ logger = null }) {
    super();
    this.logger = logger;
  }

  getName() {
    return 'reasoning';
  }

  generateDraftPrompt(prompt, context) {
    return `You are a reasoning prompt draft generator. Create a concise structured prompt (100-150 words).

Include:
- Core problem statement
- Key analytical approach
- Expected reasoning pattern

Output ONLY the draft prompt, no explanations.`;
  }

  async generateDomainContent(prompt, context, client) {
    if (!context || !client) {
      return null;
    }

    this.logger?.info('Generating reasoning domain content', {
      promptLength: prompt.length,
      hasContext: !!context
    });

    const domain = context?.specificAspects || '';
    const expertiseLevel = context?.backgroundLevel || 'intermediate';
    const useCase = context?.intendedUse || '';

    const stage1Prompt = `Generate domain-specific content for a reasoning task.

User's Prompt: "${prompt}"

Context:
- Domain Focus: ${domain || 'general'}
- Expertise Level: ${expertiseLevel}
- Intended Use: ${useCase || 'not specified'}

Generate 5-7 domain-specific warnings and 3-5 specific deliverables.

Output ONLY valid JSON:
{
  "warnings": [
    "Domain-specific warning 1",
    "Domain-specific warning 2",
    ...
  ],
  "deliverables": [
    "Specific deliverable 1",
    "Specific deliverable 2",
    ...
  ],
  "constraints": [
    "Hard constraint 1 (optional)",
    ...
  ]
}`;

    try {
      const response = await client.complete(stage1Prompt, {
        maxTokens: 1500,
        temperature: 0.3,
        timeout: 20000,
      });

      const domainContent = this._parseJSON(response.text);

      this.logger?.info('Reasoning domain content generated', {
        warningCount: domainContent.warnings?.length || 0,
        deliverableCount: domainContent.deliverables?.length || 0,
        constraintCount: domainContent.constraints?.length || 0,
      });

      return domainContent;
      
    } catch (error) {
      this.logger?.error('Failed to generate reasoning domain content', error);
      
      // Return safe fallback
      return {
        warnings: [],
        deliverables: [],
        constraints: [],
      };
    }
  }

  generateSystemPrompt(prompt, context, domainContent) {
    let systemPrompt = `You are an expert prompt engineer specializing in reasoning models.

Transform the user's prompt into a structured reasoning prompt.

<user_prompt>${prompt}</user_prompt>
`;

    // Add domain content if available
    if (domainContent && domainContent.warnings?.length > 0) {
      systemPrompt += `\n<domain_warnings>\n`;
      domainContent.warnings.forEach((warning, i) => {
        systemPrompt += `${i + 1}. ${warning}\n`;
      });
      systemPrompt += `</domain_warnings>\n`;
    }

    if (domainContent && domainContent.deliverables?.length > 0) {
      systemPrompt += `\n<domain_deliverables>\n`;
      domainContent.deliverables.forEach((deliverable, i) => {
        systemPrompt += `${i + 1}. ${deliverable}\n`;
      });
      systemPrompt += `</domain_deliverables>\n`;
    }

    if (domainContent && domainContent.constraints?.length > 0) {
      systemPrompt += `\n<constraints>\n`;
      domainContent.constraints.forEach((constraint, i) => {
        systemPrompt += `${i + 1}. ${constraint}\n`;
      });
      systemPrompt += `</constraints>\n`;
    }

    systemPrompt += `
Output structure:

**Goal**
[One sentence stating the objective]

**Return Format**
${domainContent?.deliverables?.length > 0 ? '[Use the domain deliverables provided above]' : '[Generate 3-5 specific deliverables with format requirements]'}

**Warnings**
${domainContent?.warnings?.length > 0 ? '[Use the domain warnings provided above]' : '[Generate 5-7 sophisticated domain-specific warnings]'}

**Context**
[2-4 sentences of essential technical background]

${domainContent?.constraints?.length > 0 ? '\n**Constraints**\n[Use the constraints provided above]' : ''}
`;

    return systemPrompt;
  }

  _parseJSON(text) {
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
      text.match(/```\s*([\s\S]*?)\s*```/) ||
      text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[1] || jsonMatch[0]);
  }
}
