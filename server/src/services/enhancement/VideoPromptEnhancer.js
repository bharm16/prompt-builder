/**
 * VideoPromptEnhancer
 * 
 * Zero-shot prompt builder for video suggestion generation.
 * Relies purely on user context (brainstorm, edit history, full prompt)
 * without generic poisonous examples.
 * 
 * Single Responsibility: Build contextual zero-shot prompts for AI suggestions
 */
export class VideoPromptEnhancer {
  /**
   * Build enhanced zero-shot prompt for video suggestions
   * @param {Object} params - Prompt parameters
   * @returns {string} Zero-shot prompt with context
   */
  buildEnhancedPrompt(params) {
    const { 
      highlightedText, 
      contextBefore, 
      contextAfter, 
      brainstormContext,
      fullPrompt,
      highlightedCategory,
      editHistory,
      allLabeledSpans
    } = params;

    // Format contextual sections
    const brainstormSection = this.formatBrainstorm(brainstormContext);
    const editConsistency = this.formatEditHistory(editHistory);
    const spanContext = this.formatSpanContext(allLabeledSpans);

    return `You are a video production specialist optimizing for AI video generation.

PHRASE TO ENHANCE: "${highlightedText}"
SURROUNDING CONTEXT: "${contextBefore} [PHRASE] ${contextAfter}"
${fullPrompt ? `FULL PROMPT: ${fullPrompt.substring(0, 500)}...` : ''}
${highlightedCategory ? `DETECTED CATEGORY: ${highlightedCategory}` : ''}

${brainstormSection}
${editConsistency}
${spanContext}

Generate 12 alternatives that would produce visually different results when rendered as video.

CRITICAL REQUIREMENTS:
1. Organize into exactly 4 distinct thematic categories
2. Put 3 suggestions in each category
3. Each suggestion must create a different visual outcome
4. Explain the specific visual difference for each

OUTPUT FORMAT:
Return JSON array where each object has:
- text: the replacement phrase
- category: name for the thematic group  
- explanation: how this looks different on camera

Ensure exactly 4 unique category values across all 12 suggestions.

Example structure (create your own contextual content):
[
  {"text": "replacement phrase", "category": "Category Name", "explanation": "Why this is different"},
  ...12 total suggestions across 4 categories
]`;
  }
  
  /**
   * Format brainstorm context into prompt section
   * @param {Object} context - Brainstorm context
   * @returns {string} Formatted section
   */
  formatBrainstorm(context) {
    if (!context?.elements) return '';
    
    const elements = Object.entries(context.elements)
      .filter(([_, value]) => value)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
      
    return elements ? `CREATIVE ANCHORS TO RESPECT: ${elements}\n` : '';
  }
  
  /**
   * Format edit history into prompt section
   * @param {Array} history - Edit history
   * @returns {string} Formatted section
   */
  formatEditHistory(history) {
    if (!history?.length) return '';
    
    const recent = history.slice(0, 5);
    const edits = recent.map(e => `"${e.original}" → "${e.replacement}"`).join(', ');
    
    return `RECENT EDITS (maintain consistency): ${edits}\n`;
  }
  
  /**
   * Format span context into prompt section
   * @param {Array} spans - Labeled spans
   * @returns {string} Formatted section
   */
  formatSpanContext(spans) {
    if (!spans?.length) return '';
    
    const spanSummary = spans
      .slice(0, 5) // Limit to 5 most relevant spans
      .map(s => `${s.category}: "${s.text}"`)
      .join(', ');
    
    return spanSummary ? `OTHER ELEMENTS IN PROMPT: ${spanSummary}\n` : '';
  }
}

