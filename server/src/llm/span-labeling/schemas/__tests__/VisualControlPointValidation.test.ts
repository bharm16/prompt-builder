import { describe, it, expect } from 'vitest';
import { GROQ_FULL_SYSTEM_PROMPT, GROQ_FEW_SHOT_EXAMPLES } from '../GroqSchema.js';

type AssistantSpan = { text: string; role: string };
type AssistantResponse = {
  spans: AssistantSpan[];
  meta?: { notes?: string };
  analysis_trace?: string;
};

const assistantResponses: AssistantResponse[] = GROQ_FEW_SHOT_EXAMPLES
  .filter((message) => message.role === 'assistant')
  .map((message) => JSON.parse(message.content) as AssistantResponse);

describe('VisualControlPointValidation', () => {
  it('keeps system guidance focused on renderable control points and skip rules', () => {
    expect(GROQ_FULL_SYSTEM_PROMPT).toContain('What IS a Visual Control Point?');
    expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Visual Control Point Test');
    expect(GROQ_FULL_SYSTEM_PROMPT).toContain('What to SKIP');
    expect(GROQ_FULL_SYSTEM_PROMPT).toContain('Abstract/Non-Renderable');
  });

  it('few-shot responses exclude abstract spans like "determination"', () => {
    const spanTexts = assistantResponses.flatMap((resp) =>
      resp.spans.map((span) => span.text.toLowerCase())
    );
    expect(spanTexts.some((text) => text.includes('determination'))).toBe(false);
  });

  it('example 4 treats focused demeanor as a renderable emotion', () => {
    const example4 = assistantResponses[3];
    const hasFocusedDemeanor = example4.spans.some((span) =>
      span.text.toLowerCase().includes('focused demeanor')
    );
    const hasEmotionRole = example4.spans.some((span) => span.role === 'subject.emotion');

    expect(hasFocusedDemeanor).toBe(true);
    expect(hasEmotionRole).toBe(true);
  });

  it('negative example notes clearly document skipped abstract concepts', () => {
    const example5 = assistantResponses[4];
    const trace = example5.analysis_trace?.toLowerCase() || '';
    const notes = example5.meta?.notes?.toLowerCase() || '';

    expect(trace).toContain('determination');
    expect(trace).toContain('skip');
    expect(notes).toContain('inviting the viewer');
    expect(notes).toContain('meta-commentary');
  });

  it('rich example (example 6) records skipped abstract phrases alongside full extraction', () => {
    const example6 = assistantResponses[assistantResponses.length - 1];
    const notes = example6.meta?.notes?.toLowerCase() || '';

    expect(notes).toContain('skipped abstract phrases');
    expect(notes).toContain('technical specs');
  });
});
