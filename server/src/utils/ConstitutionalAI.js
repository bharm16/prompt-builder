import { logger } from '../infrastructure/Logger.js';

/**
 * Constitutional AI Wrapper
 * Implements self-critique and revision to reduce problematic outputs
 * Based on Anthropic's Constitutional AI principles
 */
export class ConstitutionalAI {
  /**
   * Apply constitutional AI review to output
   * @param {Object} claudeClient - Claude API client
   * @param {string} originalPrompt - Original prompt
   * @param {string} initialOutput - Initial output to review
   * @param {Object} options - Options
   * @returns {Promise<Object>} Reviewed and potentially revised output
   */
  static async applyConstitutionalReview(
    claudeClient,
    originalPrompt,
    initialOutput,
    options = {}
  ) {
    const {
      principles = this.getDefaultPrinciples(),
      autoRevise = true,
      threshold = 0.7, // Confidence threshold for revision
    } = options;

    logger.debug('Starting constitutional AI review', {
      outputLength: initialOutput.length,
      principlesCount: principles.length,
    });

    // Step 1: Critique the output against principles
    const critique = await this._critiqueOutput(
      claudeClient,
      originalPrompt,
      initialOutput,
      principles
    );

    // Step 2: Decide if revision is needed
    if (!autoRevise || critique.overallScore >= threshold) {
      logger.info('Constitutional review passed', {
        score: critique.overallScore,
        revisionsNeeded: critique.issues.length,
      });

      return {
        output: initialOutput,
        revised: false,
        critique,
      };
    }

    // Step 3: Revise the output based on critique
    logger.info('Constitutional review flagged issues, revising', {
      score: critique.overallScore,
      issues: critique.issues.length,
    });

    const revisedOutput = await this._reviseOutput(
      claudeClient,
      originalPrompt,
      initialOutput,
      critique
    );

    return {
      output: revisedOutput,
      revised: true,
      critique,
      improvements: critique.issues,
    };
  }

  /**
   * Critique output against constitutional principles
   * @private
   */
  static async _critiqueOutput(
    claudeClient,
    originalPrompt,
    output,
    principles
  ) {
    const principlesList = principles
      .map((p, i) => `${i + 1}. ${p}`)
      .join('\n');

    const critiquePrompt = `You are a quality assurance reviewer evaluating an AI-generated output for potential issues.

**Original Prompt:**
${originalPrompt}

**Generated Output:**
${output}

**Constitutional Principles to Check:**
${principlesList}

**Your Task:**
Carefully review the output and identify any violations or potential issues with the constitutional principles above.

For each principle, assess:
- Does the output comply with this principle?
- If not, what specific issues are present?
- How severe is the violation (minor/moderate/major)?

Return a JSON object with this structure:
{
  "overallScore": 0.85,
  "assessment": "Brief overall assessment of the output quality",
  "issues": [
    {
      "principle": "Principle that was violated",
      "severity": "minor|moderate|major",
      "description": "Specific issue found",
      "suggestion": "How to fix it"
    }
  ]
}

If there are NO issues, return an empty issues array and a high overallScore (0.9-1.0).

**CRITICAL: Return ONLY valid JSON. No markdown, no preamble, no explanations.**`;

    const response = await claudeClient.complete(critiquePrompt, {
      maxTokens: 2048,
    });

    let critiqueText = response.content[0].text;
    critiqueText = critiqueText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const critique = JSON.parse(critiqueText);
    return critique;
  }

  /**
   * Revise output based on critique
   * @private
   */
  static async _reviseOutput(claudeClient, originalPrompt, output, critique) {
    const issuesList = critique.issues
      .map(
        (issue, i) =>
          `${i + 1}. ${issue.principle} (${issue.severity}): ${issue.description}\n   Suggestion: ${issue.suggestion}`
      )
      .join('\n\n');

    const revisionPrompt = `You are revising an AI-generated output to address identified quality issues.

**Original Prompt:**
${originalPrompt}

**Current Output:**
${output}

**Issues to Address:**
${issuesList}

**Your Task:**
Create an improved version of the output that:
1. Addresses all the identified issues
2. Maintains the core intent and informativeness of the original
3. Follows all constitutional principles
4. Preserves the original format and structure

Return ONLY the revised output. Do not include explanations, preambles, or meta-commentary about what you changed.`;

    const response = await claudeClient.complete(revisionPrompt, {
      maxTokens: 4096,
    });

    const revisedOutput = response.content[0].text.trim();

    logger.debug('Output revised via constitutional AI', {
      originalLength: output.length,
      revisedLength: revisedOutput.length,
      issuesAddressed: critique.issues.length,
    });

    return revisedOutput;
  }

  /**
   * Get default constitutional principles
   * @returns {Array<string>} Array of principles
   */
  static getDefaultPrinciples() {
    return [
      'The output should be helpful, harmless, and honest',
      'The output should avoid any harmful, unethical, racist, sexist, toxic, dangerous, or illegal content',
      'The output should be factually accurate and not contain misinformation',
      'The output should be clear, well-structured, and easy to understand',
      'The output should respect user privacy and not request or expose sensitive information',
      'The output should acknowledge uncertainty when appropriate rather than making unfounded claims',
      'The output should be relevant and directly address the user\'s request',
      'The output should maintain appropriate tone and professionalism',
    ];
  }

  /**
   * Get domain-specific principles
   * @param {string} domain - Domain type
   * @returns {Array<string>} Tailored principles
   */
  static getPrinciplesForDomain(domain) {
    const domainPrinciples = {
      'creative-content': [
        ...this.getDefaultPrinciples(),
        'The output should be original and avoid plagiarism',
        'The output should respect intellectual property and attribution',
        'The output should be age-appropriate if targeting specific audiences',
      ],

      'technical-content': [
        ...this.getDefaultPrinciples(),
        'The output should follow technical best practices and industry standards',
        'The output should include proper error handling and edge case considerations',
        'The output should be maintainable and well-documented',
      ],

      'educational-content': [
        ...this.getDefaultPrinciples(),
        'The output should be pedagogically sound and age-appropriate',
        'The output should encourage critical thinking rather than rote learning',
        'The output should be inclusive and accessible to diverse learners',
      ],

      'business-content': [
        ...this.getDefaultPrinciples(),
        'The output should be professional and maintain business etiquette',
        'The output should avoid unsubstantiated claims or promises',
        'The output should respect confidentiality and business ethics',
      ],
    };

    return domainPrinciples[domain] || this.getDefaultPrinciples();
  }

  /**
   * Quick validation check without full review
   * @param {Object} claudeClient - Claude API client
   * @param {string} output - Output to validate
   * @param {Array<string>} principles - Principles to check
   * @returns {Promise<boolean>} Whether output passes validation
   */
  static async quickValidation(claudeClient, output, principles = null) {
    const principlesToCheck = principles || this.getDefaultPrinciples();

    const validationPrompt = `Does the following output comply with these principles: ${principlesToCheck.join(', ')}?

Output: ${output}

Respond with ONLY "YES" or "NO".`;

    const response = await claudeClient.complete(validationPrompt, {
      maxTokens: 10,
    });

    const result = response.content[0].text.trim().toUpperCase();
    return result === 'YES';
  }
}
