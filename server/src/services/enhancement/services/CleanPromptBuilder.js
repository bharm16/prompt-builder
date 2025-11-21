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
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (anchors) {
        contextParts.push(`Respect these creative choices: ${anchors}`);
      }
    }

    if (Array.isArray(editHistory) && editHistory.length > 0) {
      const rejected = editHistory
        .slice(-3)
        .map((edit) => edit?.original)
        .filter(Boolean)
        .join(', ');
      if (rejected) {
        contextParts.push(`User already rejected: ${rejected}`);
      }
    }

    if (modelTarget === 'sora') {
      contextParts.push('Optimize for complex motion and physics');
    } else if (modelTarget === 'runway') {
      contextParts.push('Optimize for visual style and aesthetics');
    }

    const contextSection = contextParts.length > 0
      ? `\n${contextParts.join('\n')}\n`
      : '';

    return `Replace "${highlightedText}" with 12 visually distinct alternatives${isVideoPrompt ? ' for video generation' : ''}.
Context: ${contextBefore || ''} [HERE] ${contextAfter || ''}${contextSection}
Each must create a DIFFERENT VISUAL when filmed.
Think like a cinematographer: How would each option require different camera/lighting/framing?
Return JSON array: [{text: "suggestion", category: "approach", explanation: "visual difference"}]`;
  }

  buildPlaceholderPrompt = this.buildPrompt;
  buildRewritePrompt = this.buildPrompt;
}
