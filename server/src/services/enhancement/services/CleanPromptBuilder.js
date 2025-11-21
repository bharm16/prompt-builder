export class CleanPromptBuilder {
  buildPrompt(params) {
    const {
      highlightedText,
      contextBefore,
      contextAfter,
      brainstormContext,
      editHistory,
      modelTarget,
      isVideoPrompt,
    } = params;

    // Build minimal context that actually affects visuals
    const contextParts = [];

    if (brainstormContext?.elements) {
      const anchors = Object.entries(brainstormContext.elements)
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      if (anchors) {
        contextParts.push(`Creative anchors: ${anchors}`);
      }
    }

    if (editHistory?.length > 0) {
      const rejected = editHistory
        .slice(-3)
        .map((e) => e.original)
        .filter(Boolean)
        .join(', ');
      if (rejected) {
        contextParts.push(`Already rejected: ${rejected}`);
      }
    }

    const contextSection = contextParts.length > 0
      ? '\n' + contextParts.join('\n') + '\n'
      : '';

    // MORE EXPLICIT prompt that ensures valid JSON and context respect
    return `Generate 12 alternatives for "${highlightedText}" that could replace it in this exact sentence:

"${contextBefore}${highlightedText}${contextAfter}"



Requirements:

- Each alternative must make grammatical and narrative sense when substituted

- Each must create a different visual composition when filmed

- Maintain the emotional tone and story purpose

${contextSection}



Return ONLY valid JSON array, no other text:

[{"text":"alternative","category":"approach","explanation":"how it looks different"}]



Example structure (use exactly this format):

[

  {"text":"first option","category":"category1","explanation":"visual difference"},

  {"text":"second option","category":"category1","explanation":"visual difference"},

  {"text":"third option","category":"category2","explanation":"visual difference"}

]`;
  }

  buildPlaceholderPrompt = this.buildPrompt;
  buildRewritePrompt = this.buildPrompt;
}
