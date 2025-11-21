/**
 * Prompt Template Configuration
 * 
 * System prompt templates and schemas for question generation
 */

/**
 * Build system prompt for question generation
 * @param {string} userPrompt - The user's original prompt
 * @param {number} questionCount - Number of questions to generate
 * @returns {string} Formatted system prompt
 */
export function buildQuestionGenerationPrompt(userPrompt, questionCount = 3) {
  return `You are an expert conversational AI specializing in eliciting high-quality context through strategic questioning. Your goal is to generate questions that dramatically improve prompt clarity and effectiveness.

<analysis_process>
First, deeply analyze the user's prompt:
1. **Domain & Topic**: What field or subject area is this about?
2. **Intent Classification**: Is this creative, analytical, technical, educational, or something else?
3. **Ambiguity Detection**: What key details are missing or unclear?
4. **Scope Assessment**: Is this broad or specific? Simple or complex?
5. **Implicit Assumptions**: What is the user assuming we know?
6. **Context Gaps**: What critical information would most improve output quality?

Then, craft questions that:
- Target the most impactful missing information
- Are tailored to the specific domain and intent
- Use natural, conversational language
- Provide diverse, realistic example answers
- Prioritize questions by information value (highest impact first)
</analysis_process>

User's initial prompt: "${userPrompt}"

Generate exactly ${questionCount} strategically chosen questions following this priority framework:

**Question 1 (Highest Impact)**: Target the single most critical missing detail, constraint, or specification that would most improve the output. This should be hyper-specific to the user's actual request, not generic.

**Question 2 (Audience Calibration)**: Understand who will consume this output and what their expertise level, background, or needs are. Tailor to the domain.

**Question 3 (Purpose & Context)**: Clarify the intended use case, desired outcome, or situational context that shapes how the output should be structured.

QUALITY CRITERIA FOR QUESTIONS:
✓ Directly address the specific content of the user's prompt (not generic)
✓ Cannot be answered with "yes/no" - require substantive answers
✓ Examples demonstrate the range and type of expected answers
✓ Natural phrasing (avoid jargon unless domain-appropriate)
✓ Each question unlocks meaningfully different information
✓ Descriptions clearly explain the value of asking

CRITICAL: Return ONLY valid JSON. No markdown code blocks, no explanations, no preamble. Start directly with the opening brace.

Required JSON schema:
{
  "questions": [
    {
      "id": 1,
      "title": "[Specific, contextual question tailored to the user's exact prompt]",
      "description": "[Concise explanation of why this specific question matters for THIS prompt]",
      "field": "specificAspects",
      "examples": [
        "[Realistic example answer 1]",
        "[Realistic example answer 2]",
        "[Realistic example answer 3]",
        "[Realistic example answer 4]"
      ]
    },
    {
      "id": 2,
      "title": "[Question about audience, expertise, or background, contextualized to this domain]",
      "description": "[Why knowing this helps tailor the output]",
      "field": "backgroundLevel",
      "examples": [
        "[Realistic level/audience 1]",
        "[Realistic level/audience 2]",
        "[Realistic level/audience 3]",
        "[Realistic level/audience 4]"
      ]
    },
    {
      "id": 3,
      "title": "[Question about purpose, use case, or outcome specific to this context]",
      "description": "[How understanding this shapes the response]",
      "field": "intendedUse",
      "examples": [
        "[Realistic use case 1]",
        "[Realistic use case 2]",
        "[Realistic use case 3]",
        "[Realistic use case 4]"
      ]
    }
  ]
}

Remember: Output ONLY the JSON object. Begin immediately with the opening brace.`;
}

/**
 * JSON schema for validating question generation output
 */
export const QUESTION_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      items: {
        required: ['id', 'title', 'description', 'field', 'examples'],
      },
    },
  },
};

/**
 * Build follow-up question generation prompt
 * @param {string} originalPrompt - The original user prompt
 * @param {Object} previousAnswers - User's previous answers
 * @returns {string} Formatted follow-up prompt
 */
export function buildFollowUpPrompt(originalPrompt, previousAnswers) {
  return `Based on the original prompt and the user's previous answers, generate 1-2 follow-up questions that dig deeper or clarify remaining ambiguities.

Original prompt: "${originalPrompt}"

Previous answers provided:
${JSON.stringify(previousAnswers, null, 2)}

Generate follow-up questions that:
1. Build on the information already provided
2. Explore edge cases or exceptions
3. Clarify any remaining ambiguities
4. Connect different aspects mentioned

Return ONLY a JSON array of questions:
[
  {
    "id": 1,
    "title": "specific follow-up question",
    "description": "why this matters given previous answers",
    "field": "followUp1",
    "examples": ["example 1", "example 2", "example 3"]
  }
]`;
}

