import { describe, expect, it } from 'vitest';
import { PromptLintGateService } from '../PromptLintGateService';

describe('PromptLintGateService', () => {
  const service = new PromptLintGateService();

  it('fails lint for technical specs markdown artifacts', () => {
    const lint = service.evaluate('Scene text\n\n**TECHNICAL SPECS**\n- Duration: 8s');
    expect(lint.ok).toBe(false);
    expect(lint.errors.some((error) => error.includes('technical specs'))).toBe(true);
  });

  it('sanitizes markdown artifacts during enforcement', () => {
    const result = service.enforce({
      prompt: 'Scene text\n\n**ALTERNATIVE APPROACHES**\n- Variation 1: ...',
    });
    expect(result.prompt).toBe('Scene text');
    expect(result.repaired).toBe(true);
  });

  it('clamps prompt length for Wan limits', () => {
    const longPrompt = new Array(120).fill('word').join(' ');
    const result = service.enforce({
      prompt: longPrompt,
      modelId: 'wan-2.2',
    });
    expect(result.lint.ok).toBe(true);
    expect(result.lint.wordCount).toBeLessThanOrEqual(60);
  });
});
